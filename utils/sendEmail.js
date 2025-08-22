const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Create transporter with better error handling
let transporter;

try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    debug: true, // Enable debugging
    logger: true // Enable logging
  });

  // Verify connection configuration
  transporter.verify(function(error, success) {
    if (error) {
      console.error('❌ SMTP Connection failed:', error);
    } else {
      console.log('✅ SMTP Server is ready to take our messages');
    }
  });
} catch (error) {
  console.error('❌ Failed to create SMTP transporter:', error);
}

// Helper function to determine content type based on file extension
function getContentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.rtf': 'application/rtf',
    '.odt': 'application/vnd.oasis.opendocument.text'
  };
  return contentTypes[extension] || 'application/octet-stream';
}

async function sendReceiptEmail({ email, name, amount, currency, method, reference, date, customHtml, customSubject }) {
  // Check if transporter was created successfully
  if (!transporter) {
    console.error('❌ SMTP transporter not initialized');
    throw new Error('Email service not configured properly');
  }

  try {
    console.log(`📧 Attempting to send email to: ${email}`);
    
    const formattedAmount = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount);

    const methodIcons = {
      EVC: '💰',
      EDAHAB: '💳',
      VOLUNTEER: '👥',
      CUSTOM: '✉️'
    };

    const emailHtml = customHtml || `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="margin-top: 0; color: #444;">Donation Details</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Amount</p>
            <p style="margin: 0; font-size: 1.25rem; font-weight: bold;">${formattedAmount}</p>
          </div>
          <div>
            <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Payment Method</p>
            <p style="margin: 0; font-size: 1.25rem; font-weight: bold;">${method}</p>
          </div>
          <div>
            <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Date</p>
            <p style="margin: 0; font-size: 1.1rem;">${new Date(date).toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      <p style="margin-bottom: 1.5rem; line-height: 1.6;">
        Your generous contribution will help us continue our important work. 
        We're truly grateful for your support.
      </p>
    `;

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL || 'mucjisoduusho123@gmail.com',
      to: email,
      subject: customSubject || `Thank you for your donation (${reference})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #1e3c72, #2a5298); padding: 2rem; color: white; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 1.5rem;">${customSubject ? 'Message from Charity Organization' : 'Thank you for your donation!'}</h1>
            <p style="margin: 0.5rem 0 0; opacity: 0.9;">${customSubject ? 'Important update' : 'Your support makes a real difference.'}</p>
          </div>
          
          <div style="padding: 2rem; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
              <div style="font-size: 2rem; background: #f8f9fa; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                ${methodIcons[method] || '❤️'}
              </div>
              <div>
                <h2 style="margin: 0; font-size: 1.25rem;">${name || 'Dear Supporter'}</h2>
                <p style="margin: 0.25rem 0 0; color: #666;">Reference: ${reference}</p>
              </div>
            </div>
            
            ${emailHtml}
            
            <div style="text-align: center; margin-top: 2rem;">
              <p style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Need help or have questions?</p>
              <a href="mailto:${process.env.SUPPORT_EMAIL || 'mucjisoduusho123@gmail.com'}" style="color: #1e3c72; text-decoration: none; font-weight: bold;">Contact Our Team</a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 2rem; font-size: 0.8rem; color: #999;">
            <p>© ${new Date().getFullYear()} ${process.env.ORG_NAME || 'Charity Organization'}. All rights reserved.</p>
          </div>
        </div>
      `
    };

    console.log('📤 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Error sending email:', err);
    
    // More detailed error logging
    if (err.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check your SMTP credentials and app password.');
    } else if (err.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Check your SMTP host and port.');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timed out. Check your network connection.');
    }
    
    throw err;
  }
}

// New function to send CV notification to admin WITH ATTACHMENT
async function sendCvNotificationEmail({
  volunteerName,
  volunteerEmail,
  volunteerPhone,
  cvFileName,
  cvFilePath, // This should be the full server path to the file
  applicationDate,
  skills,
  role,
  interests
}) {
  // Check if transporter was created successfully
  if (!transporter) {
    console.error('❌ SMTP transporter not initialized');
    throw new Error('Email service not configured properly');
  }

  try {
    console.log(`📧 Attempting to send CV notification for: ${volunteerName}`);
    
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    // Check if the CV file exists
    let attachments = [];
    if (cvFilePath && fs.existsSync(cvFilePath)) {
      attachments = [{
        filename: cvFileName,
        path: cvFilePath,
        contentType: getContentType(cvFileName)
      }];
      console.log(`✅ CV file found and will be attached: ${cvFilePath}`);
    } else {
      console.warn('⚠️ CV file not found, sending notification without attachment');
    }

    const mailOptions = {
      from: process.env.DEFAULT_FROM_EMAIL || 'mucjisoduusho123@gmail.com',
      to: adminEmail,
      subject: `📄 New Volunteer CV: ${volunteerName} - ${role}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
          <div style="background: linear-gradient(135deg, #1e3c72, #2a5298); padding: 2rem; color: white; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 1.5rem;">New Volunteer CV Received</h1>
            <p style="margin: 0.5rem 0 0; opacity: 0.9;">Application submitted on ${new Date(applicationDate).toLocaleString()}</p>
          </div>
          
          <div style="padding: 2rem; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
              <div style="font-size: 2rem; background: #f8f9fa; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                📄
              </div>
              <div>
                <h2 style="margin: 0; font-size: 1.25rem;">${volunteerName}</h2>
                <p style="margin: 0.25rem 0 0; color: #666;">Applied for: ${role}</p>
              </div>
            </div>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
              <h3 style="margin-top: 0; color: #444;">Volunteer Details</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Email</p>
                  <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">
                    <a href="mailto:${volunteerEmail}" style="color: #1e3c72; text-decoration: none;">${volunteerEmail}</a>
                  </p>
                </div>
                <div>
                  <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Phone</p>
                  <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">
                    <a href="tel:${volunteerPhone}" style="color: #1e3c72; text-decoration: none;">${volunteerPhone}</a>
                  </p>
                </div>
                <div>
                  <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Skills</p>
                  <p style="margin: 0; font-size: 1.1rem;">${skills || 'Not specified'}</p>
                </div>
                <div>
                  <p style="margin: 0 0 0.5rem; font-size: 0.9rem; color: #666;">Interests</p>
                  <p style="margin: 0; font-size: 1.1rem;">${interests || 'Not specified'}</p>
                </div>
              </div>
            </div>
            
            ${attachments.length > 0 ? `
            <div style="text-align: center; padding: 1.5rem; background: #e8f5e9; border-radius: 8px; margin-bottom: 1.5rem;">
              <h3 style="margin-top: 0; color: #2e7d32;">CV Attached to This Email</h3>
              <p style="margin-bottom: 1rem;">The volunteer's CV has been attached to this email for your review.</p>
              <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">File: ${cvFileName}</p>
            </div>
            ` : `
            <div style="text-align: center; padding: 1.5rem; background: #ffebee; border-radius: 8px; margin-bottom: 1.5rem;">
              <h3 style="margin-top: 0; color: #c62828;">CV Not Available</h3>
              <p style="margin-bottom: 1rem;">The volunteer submitted a CV but the file could not be attached to this email.</p>
            </div>
            `}
            
            <div style="text-align: center; margin-top: 2rem;">
              <p style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">You can contact this volunteer directly:</p>
              <div style="display: flex; gap: 1rem; justify-content: center;">
                <a href="mailto:${volunteerEmail}" style="color: #1e3c72; text-decoration: none; font-weight: bold;">Email Volunteer</a>
                <span style="color: #ccc;">|</span>
                <a href="tel:${volunteerPhone}" style="color: #1e3c72; text-decoration: none; font-weight: bold;">Call Volunteer</a>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 2rem; font-size: 0.8rem; color: #999;">
            <p>© ${new Date().getFullYear()} ${process.env.ORG_NAME || 'Charity Organization'}. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: attachments
    };

    console.log('📤 Sending CV notification email to admin:', adminEmail);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ CV notification email sent successfully:', info.messageId);
    
    // Clean up: delete the file after sending if it exists
    if (cvFilePath && fs.existsSync(cvFilePath)) {
      try {
        fs.unlinkSync(cvFilePath);
        console.log(`🗑️ Temporary CV file deleted: ${cvFilePath}`);
      } catch (deleteError) {
        console.warn('⚠️ Could not delete temporary CV file:', deleteError.message);
      }
    }
    
    return info;
  } catch (err) {
    console.error('❌ Error sending CV notification email:', err);
    
    // More detailed error logging
    if (err.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check your SMTP credentials and app password.');
    } else if (err.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Check your SMTP host and port.');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timed out. Check your network connection.');
    }
    
    throw err;
  }
}

// Export both functions
module.exports = {
  sendReceiptEmail,
  sendCvNotificationEmail
};