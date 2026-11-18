// Renders the traceability matrix (stats, filters, expandable rows).
import { summarize } from "./sample-data.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const LABEL = { tracked: "Tracked", partial: "Partial", gap: "Gap" };
const TYPE = { kpi: "KPI", sla: "SLA", reporting: "Reporting", performance_target: "Performance target", regulatory: "Regulatory" };

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
  <div class="row" data-coverage="${esc(r.coverage)}">
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
        ${r.gap_reason ? `<div class="gapnote">${esc(r.gap_reason)}</div>` : ""}
      </div>
      <div>
        <dl class="trace">
          <div class="trace__step"><dt>Obligation</dt><dd>${esc(r.target)}</dd></div>
          <div class="trace__step"><dt>Metric</dt>${miss(r.metric_name)}</div>
          <div class="trace__step"><dt>Dashboard</dt>${miss(r.dashboard && `${r.dashboard} (${r.platform})`)}</div>
          <div class="trace__step"><dt>Data source</dt>${miss(r.data_source)}</div>
          <div class="trace__step"><dt>Confidence</dt><dd>${r.confidence != null ? Math.round(r.confidence * 100) + "%" : "—"}</dd></div>
        </dl>
        <ul class="evidence">${evidence}</ul>
      </div>
    </div>
  </div>`;
}

export function mountMatrix({ rows, statsEl, rowsEl, filterEls }) {
  let current = "all";

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
    rowsEl.innerHTML = list.length
      ? list.map(rowHtml).join("")
      : `<div style="padding:28px 18px;color:var(--dim)">No obligations in this view.</div>`;
  }

  rowsEl.addEventListener("click", (e) => {
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
}
