let cachedData = null;
let cacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return cache if fresh
  if (cachedData && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(cachedData);
  }

  try {
    const sheetId = process.env.GOOGLE_SHEET_EVENTS_ID;
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=Sheet1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      throw new Error(`Sheet fetch failed: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n');

    // Row 0 = title banner, Row 1 = headers, data starts at Row 2
    const dataLines = lines.slice(2);
    const parsed = [];

    for (const line of dataLines) {
      if (!line.trim()) continue;

      const cols = parseCSVLine(line);
      const get = (idx) => (cols[idx] || '').replace(/\r/g, '').trim();

      // Column mapping:
      // A(0)=Priority, B(1)=Event, C(2)=Host, D(3)=Time
      // E(4)=Date, F(5)=Location, G(6)=Details
      // H(7)=Registration URL, I(8)=RSVP/Pricing

      const name = get(1);
      if (!name || name === 'Event' || name === 'Cannes 2026 Event Calander') continue;

      let date = get(4);
      if (['Week', 'week', 'June 21-26', 'June 22-26', 'June 23 - 24', 'June 24 - 25'].some(x => date.includes(x))) {
        date = 'All Week';
      }

      const rsvpUrl = get(7);

      parsed.push({
        name,
        host:     get(2),
        time:     get(3) === 'TBD' ? '' : get(3),
        date,
        location: get(5),
        details:  get(6).substring(0, 150),
        rsvp:     (rsvpUrl === 'N/A' || rsvpUrl === '') ? '' : rsvpUrl,
        pricing:  (get(8) === 'TBD' || get(8) === 'N/A') ? '' : get(8)
        });
    }

    cachedData = parsed;
    cacheTime = Date.now();

    console.log(`Loaded ${parsed.length} events from sheet`);

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Events fetch error:', err.message);

    if (cachedData) {
      console.log('Returning stale cache');
      return res.status(200).json(cachedData);
    }

    return res.status(500).json({ error: err.message });
  }
}