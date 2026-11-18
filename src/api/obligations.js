// GET /api/obligations?coverage=tracked|partial|gap
// Returns the contract-to-metric traceability matrix from Supabase,
// or the bundled sample workspace when Supabase is not configured.

import { json } from "../../lib/http.js";
import { select, supabaseConfigured } from "../../lib/supabase.js";
import { SAMPLE_ROWS } from "../../public/assets/sample-data.js";

const COVERAGE = new Set(["tracked", "partial", "gap"]);

export async function onRequestGet({ request, env }) {
  const coverage = new URL(request.url).searchParams.get("coverage");
  const filter = COVERAGE.has(coverage) ? coverage : null;

  if (supabaseConfigured(env)) {
    try {
      const q = `select=*&order=obligation_id.asc${filter ? `&coverage=eq.${filter}` : ""}`;
      const rows = await select(env, "obligation_traceability", q);
      return json({ source: "supabase", rows });
    } catch (e) {
      return json({ source: "sample", warning: String(e.message || e), rows: pick(filter) });
    }
  }
  return json({ source: "sample", rows: pick(filter) });
}

function pick(filter) {
  return filter ? SAMPLE_ROWS.filter((r) => r.coverage === filter) : SAMPLE_ROWS;
}
