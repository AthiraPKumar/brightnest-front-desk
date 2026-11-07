// Vercel serverless function: POST /api/booking
// Lets Mia check free times and create bookings on Cal.com during a voice call.
//   {action:'slots', date:'YYYY-MM-DD', duration_minutes}
//   {action:'book', start, duration_minutes, name, email, phone, address, service, size, estimate_eur, notes}
// Job lengths and the location type come from the Cal.com booking type's own settings.
// The page's call to this function can be faked, so a real booking is limited
// here by IP and per instance. Cal.com itself refuses times that aren't free.

const API = 'https://api.cal.com/v2';
const SLOTS_VERSION = '2024-09-04';
const BOOKINGS_VERSION = '2026-02-25';
const EVENT_TYPES_VERSION = '2024-06-14';
const TIME_ZONE = 'Europe/Berlin';
const calKey = () => (process.env.CAL_API_KEY || '').trim();
const USERNAME = process.env.CAL_USERNAME || 'athira-prasannakumar';
const EVENT_SLUG = process.env.CAL_EVENT_SLUG || '30min';

const LIMITS = {
  slotsPerMinute: 20,   // availability checks per IP per minute
  booksPerHour: 3,      // bookings per IP per hour
  booksPerDay: 5,       // bookings per IP per day
  booksPerDayAll: 30,   // bookings per day across everyone, per instance
  searchDays: 14,       // how far ahead to look for a free day
  maxSlots: 24,         // times returned to Mia for one day
  timeoutMs: 12000,
  settingsCacheMs: 60_000,
};

// Best-effort and per instance, like api/chat.js.
const hits = new Map();
let all = { day: Date.now(), n: 0 };
function count(key, windowMs) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.since > windowMs) { hits.set(key, { since: now, n: 1 }); return 1; }
  h.n++;
  if (hits.size > 5000) { for (const [k, v] of hits) if (now - v.since > 86_400_000) hits.delete(k); }
  return h.n;
}
function bookingLimited(ip) {
  const now = Date.now();
  if (now - all.day > 86_400_000) all = { day: now, n: 0 };
  const hour = count(`h:${ip}`, 3_600_000), day = count(`d:${ip}`, 86_400_000);
  if (hour > LIMITS.booksPerHour || day > LIMITS.booksPerDay || all.n >= LIMITS.booksPerDayAll) return true;
  all.n++;
  return false;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Scripts can fake this header, so it only stops casual use from other sites.
function sameSite(req) {
  try {
    return new URL(req.headers.origin).host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
}

function fail(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}') || {}; } catch { return {}; }
}

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

const dayInBerlin = d => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const label = iso => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

async function callCal(path, options) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LIMITS.timeoutMs);
  try {
    return await fetch(API + path, { ...options, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// The booking type's public settings: allowed lengths and location type.
// If they can't be read, Cal.com's default length and location are used.
let settings = { at: 0, type: null };
async function bookingType() {
  if (settings.type && Date.now() - settings.at < LIMITS.settingsCacheMs) return settings.type;
  try {
    const query = new URLSearchParams({ username: USERNAME, eventSlug: EVENT_SLUG });
    const r = await callCal(`/event-types?${query}`, { headers: { 'cal-api-version': EVENT_TYPES_VERSION } });
    const type = r.ok ? (await r.json())?.data?.[0] : null;
    if (type) { settings = { at: Date.now(), type }; return type; }
    console.error('Cal.com booking type not found', r.status);
  } catch (e) {
    console.error('Cal.com booking type request failed', e && e.name);
  }
  return null;
}

// The shortest allowed length that fits the job, or the longest if none does.
// Null means this booking type has a single length, so Cal.com should use it.
function jobLength(type, asked) {
  const options = Array.isArray(type?.lengthInMinutesOptions) ? [...type.lengthInMinutesOptions].sort((x, y) => x - y) : [];
  if (!options.length) return null;
  const want = Number(asked) || type.lengthInMinutes || options[0];
  return options.find(m => m >= want) || options[options.length - 1];
}

async function slots(res, body) {
  const today = dayInBerlin(new Date());
  const asked = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') && !Number.isNaN(Date.parse(`${body.date}T00:00:00Z`)) ? body.date : today;
  const from = asked < today ? today : asked;
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + (LIMITS.searchDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const type = await bookingType();
  const length = jobLength(type, body.duration_minutes);
  const query = new URLSearchParams({ eventTypeSlug: EVENT_SLUG, username: USERNAME, start: from, end: to, timeZone: TIME_ZONE });
  if (length) query.set('duration', String(length));

  const r = await callCal(`/slots?${query}`, { headers: { 'cal-api-version': SLOTS_VERSION } });
  if (!r.ok) {
    console.error('Cal.com slots error', r.status);
    return fail(res, 502, 'upstream_error', 'Free times are not available right now.');
  }
  const data = (await r.json())?.data || {};
  const day = Object.keys(data).filter(d => Array.isArray(data[d]) && data[d].length).sort()[0];
  if (!day) return res.status(200).json({ ok: true, date: null, requested_date_free: false, minutes: length || type?.lengthInMinutes || null, slots: [] });

  // Spread the times across the day so Mia isn't only offered the morning.
  const times = data[day].map(s => (typeof s === 'string' ? s : s.start)).filter(Boolean);
  const step = Math.ceil(times.length / LIMITS.maxSlots);
  return res.status(200).json({
    ok: true,
    date: day,
    requested_date_free: day === from,
    minutes: length || type?.lengthInMinutes || null,
    slots: times.filter((_, i) => i % step === 0).map(start => ({ start, label: label(start) })),
  });
}

async function book(res, body, ip) {
  const name = clean(body.name, 100);
  const email = clean(body.email, 254).toLowerCase();
  const startMs = Date.parse(body.start);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || Number.isNaN(startMs) || startMs <= Date.now()) {
    return fail(res, 400, 'invalid_details', 'A name, a valid email and a future time are required.');
  }
  if (bookingLimited(ip)) {
    res.setHeader('Retry-After', '3600');
    return fail(res, 429, 'rate_limited', 'Too many bookings. Please try again later.');
  }

  const estimate = Number(body.estimate_eur);
  const notes = [
    ['Service', clean(body.service, 120)],
    ['Size', clean(body.size, 60)],
    ['Address', clean(body.address, 160)],
    ['Phone', clean(body.phone, 40)],
    ['Estimate', Number.isFinite(estimate) && estimate > 0 ? `EUR ${Math.round(estimate)}` : ''],
    ['Notes', clean(body.notes, 300)],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');

  const type = await bookingType();
  const length = jobLength(type, body.duration_minutes);
  const atCustomer = (type?.locations || []).some(l => l.type === 'attendeeAddress');

  const r = await callCal('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cal-api-version': BOOKINGS_VERSION, Authorization: `Bearer ${calKey()}` },
    body: JSON.stringify({
      start: new Date(startMs).toISOString(),
      eventTypeSlug: EVENT_SLUG,
      username: USERNAME,
      attendee: { name, email, timeZone: TIME_ZONE, language: 'en' },
      bookingFieldsResponses: { notes },
      ...(length ? { lengthInMinutes: length } : {}),
      ...(atCustomer ? { location: { type: 'attendeeAddress', address: clean(body.address, 160) || 'Address to be confirmed' } } : {}),
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || data?.status === 'error') {
    const message = String(data?.error?.message || data?.message || '');
    console.error('Cal.com booking error', r.status, data?.error?.code || '');
    if (r.status === 409 || (r.status === 400 && /avail|conflict|already|booked|limit|notice/i.test(message))) {
      return fail(res, 409, 'slot_taken', 'That time is no longer free.');
    }
    return fail(res, 502, 'upstream_error', 'The booking could not be made right now.');
  }
  const booking = data?.data || {};
  return res.status(200).json({
    ok: true,
    confirmed: booking.status === 'accepted',
    id: booking.uid || null,
    when: label(booking.start || new Date(startMs).toISOString()),
    minutes: booking.duration || length || type?.lengthInMinutes || null,
    email,
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed', 'Use POST.');
  }
  if (!sameSite(req)) return fail(res, 403, 'forbidden', 'Bookings only start from this site.');
  if (!calKey()) return fail(res, 503, 'not_configured', 'Booking is not set up on this server.');

  const body = readBody(req);
  const ip = clientIp(req);
  try {
    if (body.action === 'slots') {
      if (count(`m:${ip}`, 60_000) > LIMITS.slotsPerMinute) {
        res.setHeader('Retry-After', '60');
        return fail(res, 429, 'rate_limited', 'Too many requests. Please try again shortly.');
      }
      return await slots(res, body);
    }
    if (body.action === 'book') return await book(res, body, ip);
    return fail(res, 400, 'invalid_action', 'Unknown action.');
  } catch (e) {
    console.error('Cal.com request failed', e && e.name);
    return fail(res, 502, 'upstream_error', 'Booking is not available right now.');
  }
};
