// GET /api/regulation                      → list of preset regulation sections
// GET /api/regulation?title=16&section=314.4 → that section's text from eCFR (free public API)

import { json, error } from "../../lib/http.js";
import { fetchSection, PRESETS } from "../../lib/ecfr.js";

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const preset = PRESETS.find((p) => p.id === q.get("preset"));
  const title = preset ? preset.title : Number(q.get("title"));
  const section = preset ? preset.section : q.get("section");
  if (!title && !section) return json({ presets: PRESETS });

  if (!Number.isInteger(title) || title < 1 || title > 50) return error(400, "`title` must be a CFR title number (1-50)");
  if (!/^\d{1,4}\.\d{1,5}[a-z]?$/i.test(section || "")) return error(400, "`section` must look like 314.4");
  const part = section.split(".")[0];

  try {
    return json({ source: "ecfr", ...(await fetchSection({ title, part, section })) });
  } catch (e) {
    return error(502, String(e.message || e));
  }
}
