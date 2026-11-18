import { SAMPLE_ROWS } from "./sample-data.js";
import { heuristicExtract } from "./extract-heuristic.js";
import { mountMatrix } from "./matrix.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TYPE = { kpi: "KPI", sla: "SLA", reporting: "Reporting", performance_target: "Performance target", regulatory: "Regulatory" };

/* ---------- integration status ---------- */
fetch("/api/health")
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((h) => {
    for (const k of ["nvidia", "supabase"]) {
      const el = document.querySelector(`.status__item[data-k="${k}"]`);
      el.classList.add(h[k].configured ? "is-on" : "is-off");
      el.title = h[k].configured ? `${k} configured` : `${k} not configured — using fallback`;
    }
  })
  .catch(() => {
    document.querySelectorAll(".status__item").forEach((el) => {
      el.classList.add("is-off");
      el.title = "API not reachable — running in browser-only mode";
    });
  });

/* ---------- extraction ---------- */
const form = $("extract-form");
const run = $("run");
const hint = $("hint");
const engine = $("engine");
const results = $("results");

function renderObligations(list) {
  if (!list.length) {
    results.innerHTML = `<div class="empty">No measurable obligations found in this text.</div>`;
    return;
  }
  results.innerHTML = list
    .map((o) => {
      const target = o.target_value != null ? `${o.target_comparator ?? ""} ${o.target_value} ${o.target_unit ?? ""}`.trim() : "—";
      const conf = Math.round((o.confidence ?? 0) * 100);
      return `
      <article class="ob">
        <div class="ob__top">
          <span class="ob__id">${esc(o.id)}</span>
          <span class="ob__title">${esc(o.title)}</span>
          <span class="tag">${esc(TYPE[o.obligation_type] || o.obligation_type)}</span>
        </div>
        <dl class="ob__facts">
          <div><dt>Target</dt><dd>${esc(target)}</dd></div>
          <div><dt>Frequency</dt><dd>${esc(o.frequency || "—")}</dd></div>
          <div><dt>Suggested metric</dt><dd>${esc(o.suggested_metric || "—")}</dd></div>
          <div><dt>Confidence</dt><dd>${conf}%<span class="conf"><i style="width:${conf}%"></i></span></dd></div>
        </dl>
        <blockquote>${esc(o.source_quote)}</blockquote>
      </article>`;
    })
    .join("");
}

function setEngine(name, model) {
  engine.hidden = false;
  engine.classList.toggle("is-live", name === "nvidia");
  engine.textContent = name === "nvidia" ? `NVIDIA · ${model}` : name === "browser" ? "Rule-based · in browser" : "Rule-based";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.text.trim()) return;
  run.disabled = true;
  run.textContent = "Extracting…";
  hint.classList.remove("is-warn");
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    setEngine(body.engine, body.model);
    renderObligations(body.obligations);
    if (body.warning) {
      hint.textContent = `Model call failed, used rule-based fallback: ${body.warning}`;
      hint.classList.add("is-warn");
    }
  } catch (err) {
    // API unavailable (e.g. static hosting without Functions) — extract locally.
    setEngine("browser");
    renderObligations(heuristicExtract(data.text));
    hint.textContent = `API unavailable (${err.message}); extracted in the browser instead.`;
    hint.classList.add("is-warn");
  } finally {
    run.disabled = false;
    run.textContent = "Extract";
  }
});

/* ---------- matrix ---------- */
async function loadMatrix() {
  let rows = SAMPLE_ROWS;
  let source = "sample";
  try {
    const res = await fetch("/api/obligations");
    if (res.ok) {
      const body = await res.json();
      rows = body.rows;
      source = body.source;
    }
  } catch {
    /* keep sample */
  }
  const label = $("source");
  label.textContent = source === "supabase" ? "Source · Supabase" : "Source · Sample data";
  label.classList.toggle("is-live", source === "supabase");
  mountMatrix({
    rows,
    statsEl: $("stats"),
    rowsEl: $("matrix-rows"),
    filterEls: [...document.querySelectorAll(".filter")],
  });
}
loadMatrix();
