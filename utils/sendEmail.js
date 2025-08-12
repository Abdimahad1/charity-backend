const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // Convert string to boolean
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, html }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.DEFAULT_FROM_EMAIL,
      to,
      subject,
      html
    });
    console.log('✅ Email sent:', info.messageId);
  } catch (err) {
    console.error('❌ Error sending email:', err);
  }
}

module.exports = sendEmail;
