let cachedEvents = null;
let cacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return cached events if still fresh
  if (cachedEvents && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(cachedEvents);
  }

  try {
    const sheetId = process.env.GOOGLE_SHEET_EVENTS_ID;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=Sheet1`;

const response = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const text = await response.text();

// Parse CSV
const lines = text.trim().split('\n');

// Row 0 = title banner, Row 1 = headers, data starts at Row 2
const rows = lines.slice(2);

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

const events = [];
for (const line of rows) {
  if (!line.trim()) continue;
  const c = parseCSVLine(line);
  const get = (idx) => (c[idx] || '').trim().replace(/\n/g, ' ');

  const name = get(1);
  if (!name || name === 'Event') continue;

  let date = get(4);
  if (['Week','week','June 21-26','June 22-26','June 23 - 24','June 24 - 25'].some(x => date.includes(x))) {
    date = 'All Week';
  }

  const rsvp = get(7);

  events.push({
    name,
    host:     get(2),
    time:     get(3),
    date,
    location: get(5),
    details:  get(6).substring(0, 150),
    rsvp:     (rsvp === 'N/A' || rsvp === '') ? '' : rsvp,
    pricing:  get(8)
  });
}

    const events = [];

    // Row 0 = title banner, Row 1 = headers, data starts at Row 2
    for (let i = 2; i < rows.length; i++) {
      const c = rows[i].c || [];

      const get = (idx) => {
        if (idx >= c.length || !c[idx] || c[idx].v == null) return '';
        return String(c[idx].v).trim().replace(/\n/g, ' ');
      };

      // Column mapping:
      // A(0) = Priority, B(1) = Event, C(2) = Host, D(3) = Time
      // E(4) = Date, F(5) = Location, G(6) = Details
      // H(7) = Registration URL, I(8) = RSVP/Pricing

      const name = get(1);
      if (!name || name === 'Event') continue;

      let date = get(4);
      if (
        date.includes('Week') ||
        date.includes('week') ||
        date.includes('June 21-26') ||
        date.includes('June 22-26') ||
        date.includes('June 23 - 24') ||
        date.includes('June 24 - 25')
      ) {
        date = 'All Week';
      }

      const rsvp = get(7);

      events.push({
        name,
        host:     get(2),
        time:     get(3),
        date,
        location: get(5),
        details:  get(6).substring(0, 150),
        rsvp:     (rsvp === 'N/A' || rsvp === '') ? '' : rsvp,
        pricing:  get(8)
      });
    }

    // Update cache
    cachedEvents = events;
    cacheTime = Date.now();

    console.log(`Events loaded from sheet: ${events.length} events`);

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(events);

  } catch (err) {
    console.error('Events fetch error:', err.message);

    // Return stale cache rather than failing if available
    if (cachedEvents) {
      console.log('Returning stale cache due to fetch error');
      return res.status(200).json(cachedEvents);
    }

    return res.status(500).json({ error: 'Failed to fetch events from sheet' });
  }
}