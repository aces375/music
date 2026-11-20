// Next-due-date calculation for time-bound obligations, using public holidays from
// Nager.Date (free, no API key): https://date.nager.at/Api
// Business days exclude weekends plus U.S. federal and New York State holidays, matching the
// "Business Day" definition in the sample MSA.

const SUBDIVISION = "US-NY";

export async function fetchHolidays(years) {
  const out = new Map(); // "YYYY-MM-DD" -> holiday name
  await Promise.all(
    years.map(async (y) => {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/US`, { cf: { cacheTtl: 86400, cacheEverything: true } });
      if (!res.ok) throw new Error(`Nager.Date ${res.status}`);
      for (const h of await res.json()) {
        if (h.global || (h.counties || []).includes(SUBDIVISION)) out.set(h.date, h.name);
      }
    }),
  );
  return out;
}

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

// nth business day of a month; also returns the holidays it had to skip.
function nthBusinessDay(year, month, n, holidays) {
  const skipped = [];
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = utc(year, month, day);
    if (d.getUTCMonth() !== month) break;
    if (isWeekend(d)) continue;
    if (holidays.has(iso(d))) { skipped.push(holidays.get(iso(d))); continue; }
    if (++count === n) return { date: d, skipped };
  }
  return null;
}

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Rules are read from the obligation's target text, e.g. "≤ BD5 monthly",
// "≤ 30 days after quarter end". Returns null for obligations without a calendar deadline.
export function nextDue(target, today, holidays) {
  const t = String(target || "");
  const start = utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const bd = t.match(/BD\s?(\d+)/i);
  if (bd) {
    const n = Number(bd[1]);
    for (let i = 0; i < 3; i++) {
      const m = utc(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      const r = nthBusinessDay(m.getUTCFullYear(), m.getUTCMonth(), n, holidays);
      if (r && r.date >= start) return { date: iso(r.date), rule: `${n}${ord(n)} business day of the month`, holidays_skipped: r.skipped };
    }
  }

  const after = t.match(/(\d+)\s*days?\s+after\s+(month|quarter)\s+end/i);
  if (after) {
    const n = Number(after[1]);
    const quarter = after[2].toLowerCase() === "quarter";
    for (let i = -3; i < 6; i++) {
      // last day of each candidate period
      const first = utc(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
      if (quarter && first.getUTCMonth() % 3 !== 0) continue;
      const end = utc(first.getUTCFullYear(), first.getUTCMonth() + (quarter ? 3 : 1), 0);
      const due = addDays(end, n);
      if (due >= start) return { date: iso(due), rule: `${n} calendar days after ${quarter ? "quarter" : "month"} end`, holidays_skipped: [] };
    }
  }
  return null;
}

const ord = (n) => (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
