// Turn a venue's public post ("JAZZ & COMEDY 🎷 Fri 14 Nov, 8pm at The
// Workman's Club, €12") into an event spot. Small venues announce on their
// Instagram and Facebook pages long before (or instead of) any listings
// site, so this is how the long tail gets in: people paste or share a post,
// and venue feeds (providers/venue-posts.js) run every caption through it.
import { readSignals } from './taxonomy.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

/** A month/day with no year: this year, or next year if it has already passed. */
function upcoming(now, month, day, year) {
  if (year) return utc(year, month, day);
  const d = utc(now.getUTCFullYear(), month, day);
  return d < utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1) ? utc(now.getUTCFullYear() + 1, month, day) : d;
}

/** Find the event's date (and end date for ranges) in free text. */
export function findDates(text, now = new Date()) {
  const s = text.toLowerCase();
  const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const plus = (n) => new Date(today.getTime() + n * 864e5);
  let m;
  // ISO first: 2026-11-14
  if ((m = /\b(20\d\d)-(\d\d)-(\d\d)\b/.exec(s))) return { start: `${m[1]}-${m[2]}-${m[3]}` };
  // 14–16 Nov · 14 Nov – 16 Nov · 14 November 2026
  if ((m = new RegExp(`\\b${DAY}\\s*(?:[-–]|to)\\s*${DAY}\\s+${MON}\\b`).exec(s))) {
    const mo = MONTHS.indexOf(m[3].slice(0, 3));
    const a = upcoming(now, mo, +m[1]);
    return { start: iso(a), end: iso(utc(a.getUTCFullYear(), mo, +m[2])) };
  }
  if ((m = new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MON}\\.?(?:,?\\s+(20\\d\\d))?`).exec(s))) {
    return { start: iso(upcoming(now, MONTHS.indexOf(m[2].slice(0, 3)), +m[1], m[3] && +m[3])) };
  }
  // Nov 14 · November 14th, 2026
  if ((m = new RegExp(`\\b${MON}\\.?\\s+${DAY}\\b(?:,?\\s+(20\\d\\d))?`).exec(s))) {
    return { start: iso(upcoming(now, MONTHS.indexOf(m[1].slice(0, 3)), +m[2], m[3] && +m[3])) };
  }
  // 14/11 or 14.11(.2026): day first, as most of the world writes it
  if ((m = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d\d|\d\d))?\b/.exec(s)) && +m[2] <= 12 && +m[1] <= 31) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    return { start: iso(upcoming(now, +m[2] - 1, +m[1], y)) };
  }
  if (/\b(tonight|today)\b/.test(s)) return { start: iso(today) };
  if (/\btomorrow\b/.test(s)) return { start: iso(plus(1)) };
  // "this Friday", "Sat": the next one, today included
  if ((m = /\b(?:this\s+|next\s+)?(sun|mon|tue|wed|thu|fri|sat)(?:day|s|urday|nesday|sday|rsday)?\b/.exec(s))) {
    const diff = (DAYS.indexOf(m[1]) - today.getUTCDay() + 7) % 7;
    return { start: iso(plus(diff)) };
  }
  return {};
}

/** "8pm", "8.30 pm", "20:00", "doors 7pm" → "20:00". */
export function findTime(text) {
  const s = text.toLowerCase();
  let m = /\b(\d{1,2})(?:[:.](\d\d))?\s*(am|pm)\b/.exec(s);
  if (m) {
    let h = +m[1] % 12;
    if (m[3] === 'pm') h += 12;
    return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  }
  m = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/.exec(s);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

const VENUE_RES = [/📍\s*([^\n,|]+)/u, /(?:^|\s)@\s+([A-Z][^\n,.!|]{2,60})/, /\b(?:at|live at|venue:)\s+((?:the\s+)?[A-Z][\w'’&.-]*(?:\s+[A-Z][\w'’&.-]*){0,5})/];

/**
 * Parse a post into an event draft. Fields it can't find are listed in
 * `missing` so the person can fill them in before saving.
 */
export function parsePost(text, { url = null, cities = [], venue = null, city = null, now = new Date() } = {}) {
  const raw = String(text || '').trim().slice(0, 4000);
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || '')
    .replace(/[#@]\w+/g, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
  const { start, end } = findDates(raw, now);
  const time = findTime(raw);
  const foundVenue = venue || VENUE_RES.map((re) => re.exec(raw)?.[1]?.trim()).find(Boolean) || null;
  const foundCity = city || cities.find((c) => new RegExp(`(^|[^a-z])${c.toLowerCase()}([^a-z]|$)`).test(raw.toLowerCase())) || null;
  const price = /\bfree\s+(?:entry|admission|event)\b|\bentry\s+free\b/i.test(raw)
    ? 'Free'
    : (/[€£$฿¥]\s?\d+(?:[.,]\d\d)?|\d+(?:[.,]\d\d)?\s?(?:eur|gbp|usd|thb|baht)\b/i.exec(raw) || [])[0] || null;
  const tags = readSignals({ title: raw.replace(/#/g, ' ') }).map((x) => x.tag);
  const draft = {
    kind: 'event',
    title: title || 'Untitled event',
    venue: foundVenue,
    city: foundCity,
    starts_at: start ? (time ? `${start}T${time}` : start) : null,
    ends_at: end || null,
    price,
    tags,
    url,
    description: lines.slice(1).join(' ').slice(0, 400) || null,
  };
  draft.missing = ['starts_at', 'city', 'venue'].filter((k) => !draft[k]);
  if (!tags.length) draft.missing.push('tags');
  return draft;
}
