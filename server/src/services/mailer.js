const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

function sendPasswordResetEmail({ to, resetToken, resetLink }) {
  return transporter.sendMail({
    from: config.email.user,
    to,
    subject: 'Password Reset Request - QR Menu',
    html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Your reset code is:</p>
        <h3 style="color: #2196F3; font-size: 24px; letter-spacing: 2px;">${resetToken}</h3>
        <p>This code will expire in 30 minutes.</p>
        <p>Or click the link below:</p>
        <a href="${resetLink}" style="color: #2196F3;">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
  });
}

module.exports = { sendPasswordResetEmail };
