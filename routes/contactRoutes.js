const express = require('express');
const router = express.Router();
const { sendReceiptEmail } = require('../utils/sendEmail');
const {
  createMessage,
  getMessages,
  getMessageById,
  updateMessage,
  patchMessage,
  deleteMessage
} = require('../controllers/contactController');

// ADDED: Import the ContactMessage model
const ContactMessage = require('../models/ContactMessage');

// Enhanced contact form submission that saves to DB AND sends emails
router.post('/send', async (req, res) => {
  try {
    const { name, email, phone, subject, message, toAdmin, recipientEmail } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message'
      });
    }

    // 1. First save to database
    const newMessage = new ContactMessage({
      name, 
      email, 
      phone: phone || '', 
      subject: subject || '', 
      message
    });
    await newMessage.save();

    // 2. Send email to admin
    if (toAdmin && recipientEmail) {
      await sendReceiptEmail({
        email: recipientEmail,
        name: 'Admin',
        amount: 0,
        currency: 'USD',
        method: 'CONTACT_FORM',
        reference: `CONTACT-${Date.now()}`,
        date: new Date(),
        customHtml: `
          <div style="background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
            <h3 style="margin-top: 0; color: #444;">New Contact Form Submission</h3>
            <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
              <div>
                <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">From</p>
                <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">${name} (${email})</p>
              </div>
              ${phone ? `<div>
                <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Phone</p>
                <p style="margin: 0; font-size: 1.1rem;">${phone}</p>
              </div>` : ''}
              ${subject ? `<div>
                <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Subject</p>
                <p style="margin: 0; font-size: 1.1rem;">${subject}</p>
              </div>` : ''}
              <div>
                <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Message</p>
                <p style="margin: 0; font-size: 1.1rem; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
          </div>
        `,
        customSubject: `New Contact Form: ${subject || 'No Subject'} from ${name}`
      });
    }

    // 3. Send confirmation email to the user
    await sendReceiptEmail({
      email: email,
      name: name,
      amount: 0,
      currency: 'USD',
      method: 'CONTACT_FORM',
      reference: `CONTACT-${Date.now()}`,
      date: new Date(),
      customHtml: `
        <div style="background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
          <h3 style="margin-top: 0; color: #444;">Thank you for contacting us!</h3>
          <p style="margin-bottom: 1rem; line-height: 1.6;">
            We've received your message and will get back to you as soon as possible.
          </p>
          <div style="background: #e8f5e8; padding: 1rem; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold;">Your message:</p>
            <p style="margin: 0.5rem 0 0; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
      customSubject: 'Thank you for contacting us!'
    });

    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      data: newMessage 
    });
  } catch (error) {
    console.error('Error sending contact form:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Keep the existing routes for message management
router.get('/', getMessages);
router.get('/:id', getMessageById);
router.put('/:id', updateMessage);
router.patch('/:id', patchMessage);
router.delete('/:id', deleteMessage);

module.exports = router;
