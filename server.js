require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

app.post('/contact', async (req, res) => {
  const { name, email, phone, service, date, notes } = req.body;
  if (!name || !email || !phone)
    return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });

  try {
    // Notify KG Transportation
    await transporter.sendMail({
      from: `"KG Transportation Website" <${process.env.BREVO_USER}>`,
      to: process.env.KG_EMAIL,
      subject: `New Ride Request from ${name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <div style="background:#0a1f44;padding:20px 28px;border-radius:8px 8px 0 0">
          <h2 style="color:#d4a843;margin:0">New Contact Request</h2>
        </div>
        <div style="border:1px solid #dde1ec;border-top:none;padding:28px;border-radius:0 0 8px 8px">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Service:</strong> ${service || 'Not specified'}</p>
          ${date ? `<p><strong>Date:</strong> ${date}</p>` : ''}
          ${notes ? `<p><strong>Notes:</strong><br>${notes.replace(/\n/g,'<br>')}</p>` : ''}
          <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
          <p style="color:#888;font-size:13px">Please respond within 24 hours.</p>
        </div>
      </div>`,
    });

    // Confirm to customer
    await transporter.sendMail({
      from: `"KG Transportation" <${process.env.BREVO_USER}>`,
      to: email,
      subject: 'We received your request — KG Transportation',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <div style="background:#0a1f44;padding:20px 28px;border-radius:8px 8px 0 0">
          <h2 style="color:#d4a843;margin:0">KG Transportation</h2>
          <p style="color:#ccc;margin:4px 0 0;font-size:13px">St. Louis &amp; St. Charles Counties, Missouri</p>
        </div>
        <div style="border:1px solid #dde1ec;border-top:none;padding:28px;border-radius:0 0 8px 8px">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Thank you for reaching out! We've received your request and a member of our team will contact you shortly to confirm details.</p>
          <div style="background:#f7f8fc;border:1px solid #dde1ec;border-radius:8px;padding:18px 20px;margin:20px 0">
            <p style="margin:0 0 10px;font-weight:bold;color:#0a1f44;font-size:14px">Your Request Summary</p>
            <p style="margin:4px 0;font-size:14px"><strong>Service:</strong> ${service || 'Not specified'}</p>
            ${date ? `<p style="margin:4px 0;font-size:14px"><strong>Preferred Date:</strong> ${date}</p>` : ''}
            ${notes ? `<p style="margin:4px 0;font-size:14px"><strong>Notes:</strong> ${notes.replace(/\n/g,'<br>')}</p>` : ''}
            <p style="margin:4px 0;font-size:14px"><strong>Phone on File:</strong> ${phone}</p>
          </div>
          <p>For urgent needs, please call or text us directly at <a href="tel:+13145550100" style="color:#0a1f44">(314) 555-0100</a>.</p>
          <p style="color:#888;font-size:13px;margin-top:24px">— The KG Transportation Team · St. Louis &amp; St. Charles Counties, MO</p>
        </div>
      </div>`,
    });

    res.json({ success: true, message: "Request sent! Check your email for a confirmation — we'll be in touch soon." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Email error. Please call us directly.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
