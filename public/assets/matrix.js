// Renders the traceability matrix (stats, filters, expandable rows).
import { summarize } from "./sample-data.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const LABEL = { tracked: "Tracked", partial: "Partial", gap: "Gap" };
const TYPE = { kpi: "KPI", sla: "SLA", reporting: "Reporting", performance_target: "Performance target", regulatory: "Regulatory" };

const fmtDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const CHEVRON = `<svg class="row__chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`;

function rowHtml(r, i) {
  const metric = r.metric_name
    ? `<span class="row__metric">${esc(r.metric_name)}</span>`
    : `<span class="row__metric is-empty">— no metric</span>`;
  const evidence = (r.evidence || []).length
    ? r.evidence.map((e) => `<li><span>${esc(e.label)}</span><span>${esc(e.kind.replace("_", " "))} · ${esc(e.captured_at)}</span></li>`).join("")
    : `<li class="none"><span>No evidence — obligation is not measured</span><span>action required</span></li>`;
  const miss = (v) => (v ? `<dd>${esc(v)}</dd>` : `<dd class="missing">Not found</dd>`);
  return `
  <div class="row" data-coverage="${esc(r.coverage)}" data-id="${esc(r.obligation_id)}">
    <button class="row__main" aria-expanded="false" aria-controls="detail-${i}">
      <span class="row__id">${esc(r.obligation_id)}</span>
      <span><span class="row__title">${esc(r.obligation)}</span><span class="row__sub">${esc(TYPE[r.obligation_type] || r.obligation_type)} · ${esc(r.target)}</span></span>
      <span><span class="row__title" style="font-size:14px">${esc(r.document_title)}</span><span class="row__sub">${esc(r.clause_ref)}</span></span>
      ${metric}
      <span class="pill pill--${esc(r.coverage)}">${LABEL[r.coverage] || esc(r.coverage)}</span>
      ${CHEVRON}
    </button>
    <div class="row__detail" id="detail-${i}">
      <div>
        <blockquote class="clause">“${esc(r.clause_text)}”<cite>${esc(r.document_title)} · ${esc(r.clause_ref)} · ${esc(r.repository)}</cite></blockquote>
        ${r.document_id ? `<a class="doclink" data-doc="${esc(r.document_id)}" data-obl="${esc(r.obligation_id)}" href="/app?doc=${encodeURIComponent(r.document_id)}#${esc(r.obligation_id)}">Open clause in document →</a>` : ""}
        ${r.gap_reason ? `<div class="gapnote">${esc(r.gap_reason)}</div>` : ""}
      </div>
      <div>
        <dl class="trace">
          <div class="trace__step"><dt>Obligation</dt><dd>${esc(r.target)}</dd></div>
          <div class="trace__step"><dt>Metric</dt>${miss(r.metric_name)}</div>
          <div class="trace__step"><dt>Dashboard</dt>${miss(r.dashboard && `${r.dashboard} (${r.platform})`)}</div>
          <div class="trace__step"><dt>Data source</dt>${miss(r.data_source)}</div>
          ${r.next_due ? `<div class="trace__step"><dt>Next due</dt><dd>${esc(fmtDate(r.next_due.date))} <span class="due-rule">· ${esc(r.next_due.rule)}${r.next_due.holidays_skipped?.length ? `, skips ${esc(r.next_due.holidays_skipped.join(", "))}` : ""}</span></dd></div>` : ""}
          <div class="trace__step"><dt>Confidence</dt><dd>${r.confidence != null ? Math.round(r.confidence * 100) + "%" : "—"}</dd></div>
        </dl>
        <ul class="evidence">${evidence}</ul>
      </div>
    </div>
  </div>`;
}

// onOpenDocument(documentId, obligationId): optional; when set, "Open clause in document"
// links call it instead of navigating. limit: rows shown before a "Show all" button.
export function mountMatrix({ rows, statsEl, rowsEl, filterEls, onOpenDocument, limit = Infinity }) {
  let current = "all";
  let expanded = false;

  const s = summarize(rows);
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat"><dt>Obligations</dt><dd>${s.total}</dd></div>
      <div class="stat"><dt><span class="dot dot--tracked"></span>Tracked</dt><dd>${s.tracked}</dd></div>
      <div class="stat"><dt><span class="dot dot--partial"></span>Partial</dt><dd>${s.partial}</dd></div>
      <div class="stat"><dt><span class="dot dot--gap"></span>Gaps</dt><dd>${s.gap}</dd></div>`;
  }

  function render() {
    const list = current === "all" ? rows : rows.filter((r) => r.coverage === current);
    const shown = expanded ? list : list.slice(0, limit);
    rowsEl.innerHTML = list.length
      ? shown.map(rowHtml).join("") +
        (shown.length < list.length ? `<button class="showall">Show all ${list.length} obligations</button>` : "")
      : `<div style="padding:28px 18px;color:var(--dim)">No obligations in this view.</div>`;
  }

  rowsEl.addEventListener("click", (e) => {
    if (e.target.closest(".showall")) {
      expanded = true;
      render();
      return;
    }
    const link = e.target.closest(".doclink");
    if (link && onOpenDocument) {
      e.preventDefault();
      onOpenDocument(link.dataset.doc, link.dataset.obl);
      return;
    }
    const btn = e.target.closest(".row__main");
    if (!btn) return;
    const row = btn.parentElement;
    const open = row.toggleAttribute("data-open");
    btn.setAttribute("aria-expanded", String(open));
  });

  filterEls.forEach((b) =>
    b.addEventListener("click", () => {
      current = b.dataset.f;
      filterEls.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    }),
  );

  render();

  // Show and expand one obligation's row (used by the document reader).
  return {
    open(id) {
      current = "all";
      expanded = true;
      filterEls.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === "all")));
      render();
      const row = rowsEl.querySelector(`.row[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.setAttribute("data-open", "");
      row.querySelector(".row__main").setAttribute("aria-expanded", "true");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("is-flash");
      setTimeout(() => row.classList.remove("is-flash"), 1600);
    },
  };
}
