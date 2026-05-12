export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile, events } = req.body;

  const systemPrompt = `You are SideQuest, a Cannes Lions fringe event concierge built by Creativ Company. Given a professional's profile and a curated list of Cannes 2026 fringe events, return their top 8 events ranked by relevance.

Rules:
- Only recommend events that fall on the days the person is attending. If an event is "All Week" it qualifies for any day.
- Match events to their org type, focus areas, and topic interests.
- Respect their morning preference — if they want wellness mornings, don't fill early slots with panels.
- Match experience type preference (sessions vs. dinners vs. beach vs. mix).
- Be opinionated — exclude events that are a poor fit even if they're popular.
- For each event write exactly one sentence explaining why it's right for THIS specific person. Be specific, not generic.
- Return ONLY a JSON array. No markdown, no prose, no explanation outside the array.

JSON format for each event:
{
  "name": "exact event name from the list",
  "host": "host name",
  "date": "date string",
  "time": "time string",
  "location": "location",
  "priority": "High or Medium",
  "rsvp": "url or empty string",
  "reason": "one sentence why this fits them specifically"
}`;

  const userMsg = `My profile:
- Organization type: ${profile.orgType}
- Primary focus this week: ${profile.focus.join(', ')}
- Topics relevant to my work: ${profile.topics.join(', ')}
- Experience preference: ${profile.expType}
- Days attending: ${profile.days.join(', ')}
- Morning preference: ${profile.morningPref}

Event list:
${JSON.stringify(events, null, 2)}`;

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
        max_tokens: 1000,
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
    const clean = raw.replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(clean);
    res.status(200).json({ recommendations });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}