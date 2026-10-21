const nodemailer = require('nodemailer');
const config = require('../config');

// Brand colour for emails; keep in step with --olive-700 in client/src/styles/tokens.css.
const BRAND_COLOR = '#606b00';

const isEmailConfigured = () => Boolean(config.email.user && config.email.pass);

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.email.user, pass: config.email.pass }
    });
  }
  return transporter;
}

function sendPasswordResetEmail({ to, resetCode, resetLink }) {
  return getTransporter().sendMail({
    from: config.email.user,
    to,
    subject: 'Password Reset Request - QR Menu',
    html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Your reset code is:</p>
        <h3 style="color: ${BRAND_COLOR}; font-size: 24px; letter-spacing: 2px;">${resetCode}</h3>
        <p>This code will expire in 30 minutes.</p>
        <p>Or click the link below:</p>
        <a href="${resetLink}" style="color: ${BRAND_COLOR};">Reset Password</a>
        <p>If you didn't request this, please ignore this email.</p>
      `
  });
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Notifies the owner's mailbox (EMAIL_USER) about a landing-page enquiry.
function sendLeadNotification(lead) {
  const rows = [['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone], ['Restaurant', lead.restaurantName]]
    .filter(([, value]) => value)
    .map(([label, value]) => `<p><b>${label}:</b> ${escapeHtml(value)}</p>`)
    .join('');
  return getTransporter().sendMail({
    from: config.email.user,
    to: config.email.user,
    replyTo: lead.email,
    subject: `New enquiry from ${lead.name}`,
    html: `<h2>New enquiry</h2>${rows}<p>${escapeHtml(lead.message).replace(/\n/g, '<br>')}</p>`
  });
}

module.exports = { isEmailConfigured, sendPasswordResetEmail, sendLeadNotification };
