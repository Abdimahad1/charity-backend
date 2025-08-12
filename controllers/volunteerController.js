// controllers/volunteerController.js
const Volunteer = require('../models/Volunteer');
const { sendEmail } = require('../utils/sendEmail');

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

    // Send notification email
    let subject, body;
    if (status === 'approved') {
      subject = 'Your Volunteer Application Approved';
      body = `<p>Dear ${volunteer.fullName},</p>
              <p>We are pleased to inform you that your volunteer application has been approved. We look forward to working with you!</p>
              <p>Thank you,<br/>Our Organization</p>`;
    } else if (status === 'rejected') {
      subject = 'Your Volunteer Application';
      body = `<p>Dear ${volunteer.fullName},</p>
              <p>We regret to inform you that your volunteer application has not been accepted at this time. Thank you for your interest.</p>
              <p>Kind regards,<br/>Our Organization</p>`;
    }

    if (subject && body) {
      await sendEmail(volunteer.email, subject, body);
    }

    res.json({ message: 'Status updated and email sent', volunteer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};