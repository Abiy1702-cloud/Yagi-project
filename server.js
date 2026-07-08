require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Check required env vars on startup
const REQUIRED_ENV = ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'KG_EMAIL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ MISSING ENV VARS:', missing.join(', '));
  console.error('Set these in Render → your service → Environment tab.');
} else {
  console.log('✅ All required env vars are set.');
}

// Send email via Brevo's HTTPS API (port 443) instead of SMTP —
// Render's free tier can block/timeout outbound SMTP ports, but HTTPS always works.
async function sendBrevoEmail({ to, toName, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: 'KG Transportation', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

app.get('/health', (req, res) => {
  res.json({
    envVarsPresent: missing.length === 0,
    missing,
  });
});

app.post('/contact', async (req, res) => {
  console.log('📩 /contact hit with body:', req.body);

  const { name, email, phone, service, date, notes, website } = req.body;

  // Honeypot check — bots fill in the hidden 'website' field, humans don't
  if (website) {
    console.log('🤖 Bot detected — honeypot field filled. Ignoring submission.');
    return res.json({ success: true, message: "Request sent! We'll be in touch soon." });
  }

  if (!name || !email || !phone) {
    console.log('⚠️ Validation failed — missing required field(s).');
    return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
  }

  try {
    // Notify KG Transportation
    const ownerResult = await sendBrevoEmail({
      to: process.env.KG_EMAIL,
      toName: 'KG Transportation',
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
    console.log('✅ Owner notification sent:', ownerResult.messageId);

    // Confirm to customer
    const customerResult = await sendBrevoEmail({
      to: email,
      toName: name,
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
          <p>For urgent needs, please call or text us directly at <a href="tel:+16364435037" style="color:#0a1f44">(636) 443-5037</a>.</p>
          <p style="color:#888;font-size:13px;margin-top:24px">— The KG Transportation Team · St. Louis &amp; St. Charles Counties, MO</p>
        </div>
      </div>`,
    });
    console.log('✅ Customer confirmation sent:', customerResult.messageId);

    res.json({ success: true, message: "Request sent! Check your email for a confirmation — we'll be in touch soon." });
  } catch (err) {
    console.error('❌ EMAIL SEND FAILED:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    res.status(500).json({ success: false, message: 'Email error. Please call us directly.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
