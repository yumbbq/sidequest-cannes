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

  // Sort each day by time
  Object.keys(grouped).forEach(day => {
    grouped[day].sort((a, b) => {
      const toMins = t => {
        if (!t) return 9999;
        const str = t.split('-')[0].trim();
        const ampm = str.match(/(AM|PM)/i);
        const cleaned = str.replace(/(AM|PM)/i, '').trim();
        const parts = cleaned.split(':');
        if (parts.length < 2) return 9999;
        let h = parseInt(parts[0]);
        const m = parseInt(parts[1]) || 0;
        if (ampm) {
          const mer = ampm[0].toUpperCase();
          if (mer === 'PM' && h !== 12) h += 12;
          if (mer === 'AM' && h === 12) h = 0;
        }
        return h * 60 + m;
      };
      return toMins(a.time) - toMins(b.time);
    });
  });

  let eventsHtml = '';
  dayOrder.filter(d => grouped[d]).forEach(day => {
    eventsHtml += `
      <div style="margin-bottom:32px;">
        <div style="margin-bottom:14px;">
          <div style="display:inline-block;background:#2D1B8B;border-radius:10px;padding:8px 16px;">
            <span style="color:#F5A623;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${day}</span>
          </div>
        </div>
        ${grouped[day].map(ev => {
          const isInvite = ev.pricing && ev.pricing.toLowerCase().includes('invite');
          const mailtoUrl = `mailto:hello@creativ.com?subject=SideQuest%20%E2%80%94%20Help%20me%20get%20on%20the%20list%3A%20${encodeURIComponent(ev.name)}&body=Hi%20Creativ%20team%2C%0A%0AI%27d%20love%20to%20get%20on%20the%20list%20for%20the%20following%20event%3A%0A%0AEvent%3A%20${encodeURIComponent(ev.name)}%0AHost%3A%20${encodeURIComponent(ev.host)}%0ADate%3A%20${encodeURIComponent(ev.date)}%0ATime%3A%20${encodeURIComponent(ev.time)}%0ALocation%3A%20${encodeURIComponent(ev.location)}%0A%0AThanks!`;

          return `
          <div style="background:#ffffff;border:2px solid #e0e0f0;border-radius:14px;padding:18px 20px;margin-bottom:10px;">
            <div style="margin-bottom:6px;">
              <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">${ev.name}</div>
              <div style="font-size:12px;color:#6b6b8a;font-weight:500;">${ev.host}</div>
            </div>
            <div style="font-size:12px;color:#6b6b8a;margin-bottom:10px;line-height:1.6;">
              📍 ${ev.location}
              ${ev.time ? `&nbsp;·&nbsp; 🕐 ${ev.time}` : ''}
              ${ev.pricing ? `&nbsp;·&nbsp; 🎟 ${ev.pricing}` : ''}
            </div>
            <div style="font-size:13px;color:#6b6b8a;line-height:1.7;border-left:3px solid #F5A623;padding-left:10px;margin-bottom:14px;">
              ${ev.reason}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${ev.rsvp ? `<a href="${ev.rsvp}" style="display:inline-block;font-size:12px;font-weight:700;color:#2D1B8B;text-decoration:none;border:2px solid #2D1B8B;padding:6px 16px;border-radius:20px;">Register / Info ↗</a>` : ''}
              ${isInvite ? `<a href="${mailtoUrl}" style="display:inline-block;font-size:12px;font-weight:600;color:#888888;text-decoration:none;border:2px solid #cccccc;padding:6px 16px;border-radius:20px;">Help me get on the list ✉</a>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  });

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Cannes SideQuest Itinerary</title>
</head>
<body style="margin:0;padding:0;background:#f7f7fc;font-family:Inter,-apple-system,system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:#2D1B8B;border-radius:18px;padding:32px;text-align:center;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#F5A623;margin-bottom:12px;">
        Your SideQuest · By Creativ Company
      </div>
      <div style="font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;margin-bottom:8px;line-height:1.1;">
        Your Cannes Itinerary<span style="color:#F5A623;">.</span>
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);font-weight:500;">
        ${events.length} events tailored for a ${profile.orgType} · ${profile.days.join(', ')}
      </div>
    </div>

    <!-- Events -->
    ${eventsHtml}

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:2px solid #e0e0f0;margin-top:8px;">
      <div style="font-size:12px;color:#9999bb;margin-bottom:6px;">
        Built by <a href="https://creativ.com" style="color:#2D1B8B;font-weight:700;text-decoration:none;">Creativ Company</a>
      </div>
      <div style="font-size:11px;color:#9999bb;">
        Cannes Lions 2026 · <a href="https://sidequest.creativ.com" style="color:#9999bb;">sidequest.creativ.com</a>
      </div>
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

  // Log to Google Sheets via Apps Script webhook
  try {
    await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        email: email,
        orgType: profile.orgType,
        days: profile.days.join(', '),
        expType: profile.expType || ''
      })
    });
  } catch (err) {
    console.error('Sheets webhook error:', err);
  }

  res.status(200).json({ success: true });
}