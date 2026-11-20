// GET /api/obligations?coverage=tracked|partial|gap
// Returns the contract-to-metric traceability matrix from Supabase (or the bundled sample
// workspace when Supabase is not configured), with the next due date of time-bound
// obligations computed from Nager.Date public holidays.

import { json } from "../../lib/http.js";
import { select, supabaseConfigured } from "../../lib/supabase.js";
import { fetchHolidays, nextDue } from "../../lib/due.js";
import { SAMPLE_ROWS } from "../../public/assets/sample-data.js";

const COVERAGE = new Set(["tracked", "partial", "gap"]);

export async function onRequestGet({ request, env }) {
  const coverage = new URL(request.url).searchParams.get("coverage");
  const filter = COVERAGE.has(coverage) ? coverage : null;

  let body;
  if (supabaseConfigured(env)) {
    try {
      const q = `select=*&order=obligation_id.asc${filter ? `&coverage=eq.${filter}` : ""}`;
      body = { source: "supabase", rows: await select(env, "obligation_traceability", q) };
    } catch (e) {
      body = { source: "sample", warning: String(e.message || e), rows: pick(filter) };
    }
  } else {
    body = { source: "sample", rows: pick(filter) };
  }
  return json(await withDueDates(body));
}

async function withDueDates(body) {
  const today = new Date();
  let holidays = new Map();
  try {
    holidays = await fetchHolidays([today.getUTCFullYear(), today.getUTCFullYear() + 1]);
    body.calendar = { source: "nager.date", holidays: holidays.size };
  } catch (e) {
    body.calendar = { source: "weekends only", warning: String(e.message || e) };
  }
  body.rows = body.rows.map((r) => ({ ...r, next_due: nextDue(r.target, today, holidays) }));
  return body;
}

function pick(filter) {
  return filter ? SAMPLE_ROWS.filter((r) => r.coverage === filter) : SAMPLE_ROWS;
}
