export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, events, profile } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Build day-grouped event HTML
  const dayOrder = [
    'Sunday, June 21', 'Monday, June 22', 'Tuesday, June 23',
    'Wednesday, June 24', 'Thursday, June 25', 'Friday, June 26', 'All Week'
  ];

  const grouped = {};
  events.forEach(ev => {
    let key = ev.date || 'All Week';
    if (key.includes('Week') || key.includes('week')) key = 'All Week';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const dayColors = {
    'Sunday, June 21': '#2D1B8B',
    'Monday, June 22': '#2D1B8B',
    'Tuesday, June 23': '#2D1B8B',
    'Wednesday, June 24': '#2D1B8B',
    'Thursday, June 25': '#2D1B8B',
    'Friday, June 26': '#2D1B8B',
    'All Week': '#2D1B8B'
  };

  let eventsHtml = '';
  dayOrder.filter(d => grouped[d]).forEach(day => {
    eventsHtml += `
      <div style="margin-bottom: 32px;">
        <div style="background: #2D1B8B; border-radius: 10px; padding: 10px 16px; margin-bottom: 16px; display: inline-block;">
          <span style="color: #F5A623; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">${day}</span>
        </div>
        ${grouped[day].map(ev => `
          <div style="background: #ffffff; border: 2px solid #e0e0f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 2px;">${ev.name}</div>
                <div style="font-size: 12px; color: #6b6b8a; font-weight: 500;">${ev.host}</div>
              </div>
            </div>
            <div style="font-size: 12px; color: #6b6b8a; margin-bottom: 10px;">
              📍 ${ev.location}${ev.time ? ` &nbsp;·&nbsp; 🕐 ${ev.time}` : ''}${ev.pricing ? ` &nbsp;·&nbsp; 🎟 ${ev.pricing}` : ''}
            </div>
            <div style="font-size: 13px; color: #6b6b8a; line-height: 1.6; border-left: 3px solid #F5A623; padding-left: 10px; margin-bottom: ${ev.rsvp ? '12px' : '0'};">
              ${ev.reason}
            </div>
            ${ev.rsvp ? `<a href="${ev.rsvp}" style="display: inline-block; font-size: 12px; font-weight: 700; color: #2D1B8B; text-decoration: none; border: 2px solid #2D1B8B; padding: 6px 16px; border-radius: 20px;">Register / Info ↗</a>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  });

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f7f7fc; font-family: Inter, -apple-system, system-ui, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <!-- Header -->
    <div style="background: #2D1B8B; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #F5A623; margin-bottom: 12px;">Your SideQuest · By Creativ Company</div>
      <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 8px;">Your Cannes Itinerary<span style="color: #F5A623;">.</span></div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.5);">${events.length} events tailored for a ${profile.orgType} · ${profile.days.join(', ')}</div>
    </div>

    <!-- Events -->
    ${eventsHtml}

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0; border-top: 2px solid #e0e0f0; margin-top: 8px;">
      <div style="font-size: 12px; color: #9999bb; margin-bottom: 8px;">Built by <a href="https://creativ.com" style="color: #2D1B8B; font-weight: 700; text-decoration: none;">Creativ Company</a></div>
      <div style="font-size: 11px; color: #9999bb;">Cannes Lions 2026 · sidequest.creativ.com</div>
    </div>
  </div>
</body>
</html>`;

  // Send email via Resend
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'SideQuest by Creativ Company <hello@creativ.com>',
        to: [email],
        subject: `Your Cannes Lions 2026 SideQuest Itinerary`,
        html: emailHtml
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  // Log to Google Sheets
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const { google } = await import('googleapis');

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          email,
          profile.orgType,
          profile.days.join(', '),
          profile.expType || ''
        ]]
      }
    });
  } catch (err) {
    console.error('Sheets logging error:', err);
    // Don't fail the request if logging fails — email already sent
  }

  res.status(200).json({ success: true });
}