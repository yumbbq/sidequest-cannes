export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile, events } = req.body;

  const systemPrompt = `You are SideQuest, a Cannes Lions fringe event concierge built by Creativ Company. Given a professional's profile and a curated list of Cannes 2026 fringe events, return personalized event recommendations ranked by relevance.

Rules:
- Only recommend events that fall on the days the person is attending. Events with date "All Week" qualify for any day they are attending.
- Use the event's "details" field as your primary matching signal — it contains speaker names, themes, audience type, session format, and access notes. Read it carefully before deciding if an event fits.
- Match events strongly to their org type, focus areas, and topics. Be specific and deliberate — a junior creative event should never go to a VP, a CMO-only dinner should only go to brand-side leaders.
- Respect their morning preference — if they want wellness mornings, include morning wellness events and avoid stacking early panels. If they prefer to hit the ground at 11, avoid early morning recommendations.
- Be opinionated — exclude events that are a poor fit even if they are prominent or popular.
- Spread recommendations across all days the person is attending. Do not cluster events on one day.
- Include a mix of morning, afternoon, and evening events where available and appropriate.
- For each event write exactly one sentence explaining why it is right for THIS specific person. Reference their org type, focus area, or topic directly. Be specific, not generic.
- Return ONLY a raw JSON array. No markdown, no backticks, no explanation, no text before or after the array. Start your response with [ and end with ].
- If the user has listed specific events they already plan to attend, include those in the results and build the rest of the schedule around them to avoid time conflicts where possible.

Schedule preference determines how many events to return — respect this count strictly:
- "Light schedule — 3 to 4 curated events, high signal only": return exactly 8 events, the highest-signal matches only
- "Balanced schedule — 5 to 6 events mixing sessions and networking": return exactly 12 events with a deliberate mix of session types
- "Full schedule — 7 to 8 events, maximize your day with a lot of options": return exactly 18 events spread across all attending days with morning, afternoon, and evening coverage

JSON format for each event — include all fields:
{
  "name": "exact event name from the list",
  "host": "host name",
  "date": "date string",
  "time": "time string",
  "location": "location",
  "rsvp": "url or empty string",
  "pricing": "pricing string or empty string",
  "reason": "one sentence referencing their org type or specific focus area explaining why this fits them"
}`;

  // Pre-filter events to only days the person is attending + All Week
  const attendingDays = profile.days.map(d => d.toLowerCase());

  const filteredEvents = events.filter(ev => {
    if (!ev.date) return true;
    const date = ev.date.toLowerCase();

    // Always include All Week events
    if (
      date === 'all week' ||
      date.includes('week of') ||
      date.includes('june 21-26') ||
      date.includes('june 22-26') ||
      date.includes('june 23 - 24') ||
      date.includes('june 24 - 25')
    ) return true;

    // Match specific days
    return attendingDays.some(day => {
      if (day.includes('sunday') && date.includes('sunday')) return true;
      if (day.includes('monday') && date.includes('monday')) return true;
      if (day.includes('tuesday') && date.includes('tuesday')) return true;
      if (day.includes('wednesday') && date.includes('wednesday')) return true;
      if (day.includes('thursday') && date.includes('thursday')) return true;
      if (day.includes('friday') && date.includes('friday')) return true;
      return false;
    });
  });

  // Trim details to 300 chars to save tokens while keeping key context
  const trimmedEvents = filteredEvents.map(ev => ({
    ...ev,
    details: ev.details ? ev.details.substring(0, 150) : ''
  }));

  const userMsg = `My profile:
- Organization type: ${profile.orgType}
- Primary focus this week: ${profile.focus.join(', ')}
- Topics relevant to my work: ${profile.topics.join(', ')}
- Schedule preference: ${profile.expType}
- Days attending: ${profile.days.join(', ')}
- Morning preference: ${profile.morningPref}
${profile.mustAttend ? `- Events already on my radar that I plan to attend: ${profile.mustAttend}` : ''}


Event list (${trimmedEvents.length} events matching my attending days):
${JSON.stringify(trimmedEvents, null, 2)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', JSON.stringify(data));
      return res.status(500).json({ error: `API error: ${data.error?.message || 'Unknown error'}` });
    }

    if (!data.content || !data.content.length) {
      console.error('Empty response from Anthropic:', JSON.stringify(data));
      return res.status(500).json({ error: 'Empty response from API' });
    }

    const raw = data.content.map(b => b.text || '').join('');

    let clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      clean = arrayMatch[0];
    }

    let recommendations;
    try {
      recommendations = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      console.error('Raw response preview:', raw.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse recommendations. Please try again.' });
    }

    res.status(200).json({ recommendations });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}