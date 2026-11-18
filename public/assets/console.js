import { SAMPLE_ROWS, SAMPLE_DOCUMENTS, markdownToText, normalize } from "./sample-data.js";
import { heuristicExtract } from "./extract-heuristic.js";
import { mountMatrix } from "./matrix.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TYPE = { kpi: "KPI", sla: "SLA", reporting: "Reporting", performance_target: "Performance target", regulatory: "Regulatory" };
const LABEL = { tracked: "Tracked", partial: "Partial", gap: "Gap" };

let catalog = SAMPLE_ROWS; // replaced by /api/obligations rows once loaded
let matrix = null;

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

/* ---------- catalog matching ---------- */
// Does an extracted quote refer to the same clause as a catalog row?
function findInCatalog(quote) {
  const q = normalize(quote);
  if (q.length < 20) return null;
  return (
    catalog.find((r) => {
      const c = normalize(r.clause_text);
      return q.includes(c) || c.includes(q) || q.includes(c.slice(0, 60)) || c.includes(q.slice(0, 60));
    }) || null
  );
}

/* ---------- sample documents ---------- */
const bodies = new Map();
async function loadBody(doc) {
  if (!bodies.has(doc.document_id)) {
    const res = await fetch(doc.file);
    if (!res.ok) throw new Error(`Could not load ${doc.file}`);
    bodies.set(doc.document_id, await res.text());
  }
  return bodies.get(doc.document_id);
}

function renderDocCards() {
  $("docs").innerHTML = SAMPLE_DOCUMENTS.map((d) => {
    const rows = catalog.filter((r) => r.document_id === d.document_id);
    const n = { tracked: 0, partial: 0, gap: 0 };
    rows.forEach((r) => n[r.coverage]++);
    return `
    <article class="doc" data-doc="${esc(d.document_id)}">
      <div class="doc__top"><span class="tag">${esc(d.document_type)}</span><span class="doc__id">${esc(d.document_id)}</span></div>
      <h4>${esc(d.title)}</h4>
      <p>${esc(d.summary)}</p>
      <div class="doc__meta">${esc(d.counterparty)} · Effective ${esc(d.effective_date)}</div>
      <div class="doc__bar" aria-hidden="true"><i class="t" style="flex:${n.tracked}"></i><i class="p" style="flex:${n.partial}"></i><i class="g" style="flex:${n.gap}"></i></div>
      <div class="doc__counts">${rows.length} obligations · ${n.tracked} tracked · ${n.partial} partial · ${n.gap} gap</div>
      <div class="doc__actions">
        <button class="btn btn--sm" type="button" data-act="read">Read</button>
        <button class="btn btn--sm btn--ghost-fill" type="button" data-act="extract">Extract</button>
      </div>
    </article>`;
  }).join("");
}

$("docs").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest(".doc").dataset.doc;
  if (btn.dataset.act === "read") openDocument(id);
  else extractDocument(id);
});

// Minimal markdown renderer for the sample documents (headings, paragraphs, lists, bold/italic, callouts).
function inline(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(md, rows) {
  const squash = (s) => normalize(s);
  return md
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n");
      if (/^---+$/.test(block.trim())) return "<hr />";
      if (block.startsWith(">")) return `<div class="callout">${inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</div>`;
      const h = block.match(/^(#{1,3})\s+(.*)$/);
      if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      if (lines.every((l) => l.startsWith("- "))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;

      const html = `<p>${lines.map(inline).join("<br />")}</p>`;
      const plain = squash(markdownToText(block));
      const hits = rows.filter((r) => plain.includes(squash(r.clause_text)));
      if (!hits.length) return html;
      const worst = hits.some((r) => r.coverage === "gap") ? "gap" : hits.some((r) => r.coverage === "partial") ? "partial" : "tracked";
      const badges = hits
        .map((r) => `<button class="hit__badge" type="button" data-obl="${esc(r.obligation_id)}" title="${esc(r.obligation)}">${esc(r.obligation_id)} · ${LABEL[r.coverage]}</button>`)
        .join("");
      return `<div class="hit hit--${worst}" id="${esc(hits[0].obligation_id)}">${html}<div class="hit__badges">${badges}</div></div>`;
    })
    .join("\n");
}

async function openDocument(id, obligationId) {
  const doc = SAMPLE_DOCUMENTS.find((d) => d.document_id === id);
  if (!doc) return;
  const md = await loadBody(doc);
  document.querySelectorAll(".doc").forEach((el) => el.classList.toggle("is-open", el.dataset.doc === id));
  $("reader-id").textContent = doc.document_id;
  $("reader-title").textContent = doc.title;
  $("reader-download").href = doc.file;
  $("reader-extract").dataset.doc = id;
  $("paper").innerHTML = renderMarkdown(md, catalog.filter((r) => r.document_id === id));
  $("reader").hidden = false;
  history.replaceState(null, "", `?doc=${encodeURIComponent(id)}${obligationId ? `#${obligationId}` : ""}`);

  const target = obligationId && document.getElementById(obligationId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("is-flash");
    setTimeout(() => target.classList.remove("is-flash"), 1600);
  } else {
    $("reader").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

$("paper").addEventListener("click", (e) => {
  const b = e.target.closest(".hit__badge");
  if (b && matrix) matrix.open(b.dataset.obl);
});
$("reader-close").addEventListener("click", () => {
  $("reader").hidden = true;
  document.querySelectorAll(".doc").forEach((el) => el.classList.remove("is-open"));
  history.replaceState(null, "", location.pathname);
});
$("reader-extract").addEventListener("click", (e) => extractDocument(e.currentTarget.dataset.doc));

async function extractDocument(id) {
  const doc = SAMPLE_DOCUMENTS.find((d) => d.document_id === id);
  const md = await loadBody(doc);
  form.elements.document_title.value = doc.title;
  form.elements.document_type.value = doc.document_type;
  form.elements.text.value = markdownToText(md);
  $("extract").scrollIntoView({ behavior: "smooth", block: "start" });
  form.requestSubmit();
}

/* ---------- extraction ---------- */
const form = $("extract-form");
const run = $("run");
const hint = $("hint");
const engine = $("engine");
const results = $("results");
const summary = $("results-summary");
const HINT = hint.innerHTML;

function renderObligations(list) {
  if (!list.length) {
    summary.hidden = true;
    results.innerHTML = `<div class="empty">No measurable obligations found in this text.</div>`;
    return;
  }
  const matched = list.map((o) => ({ o, hit: findInCatalog(o.source_quote) }));
  const known = matched.filter((m) => m.hit).length;
  summary.hidden = false;
  summary.innerHTML = `<span><b>${list.length}</b> obligations found</span><span><b>${known}</b> already in catalog</span><span><b>${list.length - known}</b> new — not yet traced</span>`;

  results.innerHTML = matched
    .map(({ o, hit }) => {
      const target = o.target_value != null ? `${o.target_comparator ?? ""} ${o.target_value} ${o.target_unit ?? ""}`.trim() : "—";
      const conf = Math.round((o.confidence ?? 0) * 100);
      const badge = hit
        ? `<button class="match match--${esc(hit.coverage)}" type="button" data-obl="${esc(hit.obligation_id)}">In catalog · ${esc(hit.obligation_id)} · ${LABEL[hit.coverage]}</button>`
        : `<span class="match match--new">New · not in catalog</span>`;
      return `
      <article class="ob">
        <div class="ob__top">
          <span class="ob__id">${esc(o.id)}</span>
          <span class="ob__title">${esc(o.title)}</span>
          <span class="tag">${esc(TYPE[o.obligation_type] || o.obligation_type)}</span>
          ${badge}
        </div>
        <dl class="ob__facts">
          <div><dt>Target</dt><dd>${esc(target)}</dd></div>
          <div><dt>Frequency</dt><dd>${esc(o.frequency || "—")}</dd></div>
          <div><dt>Suggested metric</dt><dd>${esc(o.suggested_metric || hit?.metric_name || "—")}</dd></div>
          <div><dt>Confidence</dt><dd>${conf}%<span class="conf"><i style="width:${conf}%"></i></span></dd></div>
        </dl>
        <blockquote>${esc(o.source_quote)}</blockquote>
      </article>`;
    })
    .join("");
}

results.addEventListener("click", (e) => {
  const b = e.target.closest(".match[data-obl]");
  if (b && matrix) matrix.open(b.dataset.obl);
});

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
  hint.innerHTML = HINT;
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
    renderObligations(heuristicExtract(data.text, { documentType: data.document_type }));
    hint.textContent = `API unavailable (${err.message}); extracted in the browser instead.`;
    hint.classList.add("is-warn");
  } finally {
    run.disabled = false;
    run.textContent = "Extract";
  }
});

/* ---------- matrix + initial state ---------- */
async function init() {
  let source = "sample";
  try {
    const res = await fetch("/api/obligations");
    if (res.ok) {
      const body = await res.json();
      catalog = body.rows;
      source = body.source;
    }
  } catch {
    /* keep sample */
  }
  const label = $("source");
  label.textContent = source === "supabase" ? "Source · Supabase" : "Source · Sample data";
  label.classList.toggle("is-live", source === "supabase");

  matrix = mountMatrix({
    rows: catalog,
    statsEl: $("stats"),
    rowsEl: $("matrix-rows"),
    filterEls: [...document.querySelectorAll(".filter")],
    onOpenDocument: (doc, obl) => openDocument(doc, obl),
  });
  renderDocCards();

  const doc = new URLSearchParams(location.search).get("doc");
  if (doc) openDocument(doc, decodeURIComponent(location.hash.slice(1)) || undefined);
}
init();
