const Volunteer = require('../models/Volunteer');
const { sendReceiptEmail, sendCvNotificationEmail } = require('../utils/sendEmail');
const path = require('path');
const fs = require('fs');

exports.applyVolunteer = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      city,
      district,
      availability,
      role,
      skills,
      message,
      interests
    } = req.body;

    // Safely parse "interests"
    let parsedInterests = [];
    if (Array.isArray(interests)) {
      parsedInterests = interests;
    } else if (typeof interests === 'string') {
      try {
        const maybeJSON = JSON.parse(interests);
        parsedInterests = Array.isArray(maybeJSON) ? maybeJSON : [maybeJSON];
      } catch {
        parsedInterests = interests
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    }

    const volunteer = new Volunteer({
      fullName,
      email,
      phone,
      city,
      district,
      availability,
      role,
      skills,
      message,
      interests: parsedInterests,
      cvFile: req.file ? `/uploads/cv/${req.file.filename}` : null
    });

    await volunteer.save();

    // Send notification email to admin if CV was uploaded
    if (req.file) {
      try {
        // Get the full server path to the CV file
        const cvFilePath = path.join(__dirname, '..', 'uploads', 'cv', req.file.filename);
        
        await sendCvNotificationEmail({
          volunteerName: fullName,
          volunteerEmail: email,
          volunteerPhone: phone,
          cvFileName: req.file.originalname,
          cvFilePath: cvFilePath,
          applicationDate: new Date(),
          skills: skills,
          role: role,
          interests: parsedInterests.join(', ')
        });
        console.log('✅ CV notification email sent to admin');
      } catch (emailError) {
        console.error('❌ Failed to send CV notification email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    res.status(201).json({
      message: 'Volunteer application submitted successfully',
      volunteer
    });
  } catch (err) {
    console.error('applyVolunteer error:', err);
    res.status(500).json({ message: 'Failed to submit volunteer application' });
  }
};

exports.getVolunteers = async (req, res) => {
  try {
    const volunteers = await Volunteer.find().sort({ createdAt: -1 });
    res.json(volunteers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch volunteers' });
  }
};

exports.updateVolunteerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const volunteer = await Volunteer.findById(id);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    volunteer.status = status;
    await volunteer.save();

    // Send notification email - FIXED: using sendReceiptEmail instead of sendEmail
    let subject, body;
    if (status === 'approved') {
      subject = 'Your Volunteer Application Has Been Approved!';
      body = `<p>Dear ${volunteer.fullName},</p>
              <p>We are pleased to inform you that your volunteer application has been approved! Welcome to our team!</p>
              <p>Our team will contact you shortly to discuss next steps and onboarding.</p>
              <p>Thank you for your willingness to contribute to our cause.</p>
              <p>Best regards,<br/>The Volunteer Coordination Team</p>`;
    } else if (status === 'rejected') {
      subject = 'Update on Your Volunteer Application';
      body = `<p>Dear ${volunteer.fullName},</p>
              <p>Thank you for your interest in volunteering with us and for taking the time to apply.</p>
              <p>After careful consideration, we regret to inform you that we are unable to move forward with your application at this time. We received a large number of applications and had to make difficult decisions.</p>
              <p>We encourage you to apply again in the future as our needs may change.</p>
              <p>We appreciate your understanding and wish you the best in your future endeavors.</p>
              <p>Sincerely,<br/>The Volunteer Coordination Team</p>`;
    }

    if (subject && body) {
      try {
        // Create a custom email using the receipt email function but with volunteer content
        await sendReceiptEmail({
          email: volunteer.email,
          name: volunteer.fullName,
          amount: 0, // Not a donation, but we need these fields
          currency: 'USD',
          method: 'VOLUNTEER',
          reference: `VOL-${volunteer._id.toString().slice(-6)}`,
          date: new Date(),
          customHtml: body,
          customSubject: subject
        });
        console.log(`✅ Volunteer status email sent to ${volunteer.email}`);
      } catch (emailError) {
        console.error('❌ Failed to send volunteer status email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    res.json({ 
      message: 'Status updated successfully', 
      volunteer,
      emailSent: !!(subject && body)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// Optional: Add endpoint to send custom emails to volunteers
exports.sendCustomEmail = async (req, res) => {
  try {
    const { email, subject, message, volunteerId } = req.body;
    
    await sendReceiptEmail({
      email,
      name: '', // Will be handled in the template
      amount: 0,
      currency: 'USD',
      method: 'CUSTOM',
      reference: `CUSTOM-${Date.now()}`,
      date: new Date(),
      customHtml: message,
      customSubject: subject
    });
    
    res.json({ message: 'Custom email sent successfully' });
  } catch (err) {
    console.error('Error sending custom email:', err);
    res.status(500).json({ message: 'Failed to send custom email' });
  }
};