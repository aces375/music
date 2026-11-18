// Sample traceability workspace built on three fictional documents in /public/samples.
// Every clause_text below is quoted verbatim from those files (checked by `npm run seed`).
// Used by the landing page, by the console when the API is unreachable, by /api/obligations
// when Supabase is not configured, and by scripts/build-seed.mjs to generate supabase/seed.sql.
// Row shape mirrors the `obligation_traceability` view in supabase/migrations.

export const SAMPLE_DOCUMENTS = [
  {
    document_id: "MSA-2026-014",
    title: "Northwind Hosting MSA",
    document_type: "MSA",
    counterparty: "Northwind Cloud Hosting, Inc.",
    effective_date: "2026-03-01",
    repository: "SharePoint / Legal / Vendor MSAs",
    file: "/samples/northwind-hosting-msa.md",
    summary: "Managed hosting: availability, incident response, security assurance and disaster recovery.",
  },
  {
    document_id: "SOW-03",
    title: "Contact Center Services SOW #3",
    document_type: "SOW",
    counterparty: "Fabrikam Customer Care LLC",
    effective_date: "2026-07-01",
    repository: "SharePoint / Operations / Outsourcing",
    file: "/samples/fabrikam-contact-center-sow-03.md",
    summary: "Outsourced contact center: service level, FCR, CSAT, reporting and invoicing KPIs.",
  },
  {
    document_id: "POL-PRV-005",
    title: "Data Protection & Privacy Policy v5",
    document_type: "Compliance",
    counterparty: "Internal policy",
    effective_date: "2026-01-15",
    repository: "SharePoint / Risk & Compliance / Policies",
    file: "/samples/contoso-data-protection-policy-v5.md",
    summary: "Regulatory commitments: breach notification, data subject requests, access reviews, training.",
  },
];

const DOCS = Object.fromEntries(SAMPLE_DOCUMENTS.map((d) => [d.document_id, d]));

// `t` is [comparator, value, unit, frequency] — stored as structured fields in Supabase.
function row(document_id, r) {
  const d = DOCS[document_id];
  return {
    obligation_id: r.id,
    obligation: r.obligation,
    obligation_type: r.type,
    document_id,
    document_title: d.title,
    document_type: d.document_type,
    repository: d.repository,
    clause_ref: r.ref,
    clause_text: r.clause,
    target: r.target,
    target_parts: r.t,
    metric_name: r.metric ?? null,
    dashboard: r.dashboard ?? null,
    platform: r.platform ?? null,
    data_source: r.source ?? null,
    coverage: r.coverage,
    confidence: r.confidence,
    gap_reason: r.gap ?? null,
    evidence: r.evidence ?? [],
  };
}

export const SAMPLE_ROWS = [
  /* ---------------- Northwind Hosting MSA ---------------- */
  row("MSA-2026-014", {
    id: "OBL-0101", type: "sla", ref: "§4.2",
    obligation: "Monthly platform availability ≥ 99.9%",
    clause: "Supplier shall ensure the Hosted Services are Available at least 99.9% of each calendar month, excluding Scheduled Maintenance notified no less than five (5) Business Days in advance.",
    target: "≥ 99.9% / month", t: [">=", 99.9, "%", "monthly"],
    metric: "uptime_monthly_pct", dashboard: "Vendor Performance › Hosting SLA", platform: "Power BI",
    source: "Datadog → Snowflake.VENDOR.UPTIME_DAILY",
    coverage: "tracked", confidence: 0.96,
    evidence: [
      { kind: "report_export", label: "Oct 2026 Hosting SLA report (PDF)", captured_at: "2026-11-02" },
      { kind: "query", label: "SELECT avg(availability) FROM UPTIME_DAILY", captured_at: "2026-11-02" },
    ],
  }),
  row("MSA-2026-014", {
    id: "OBL-0102", type: "performance_target", ref: "§4.4",
    obligation: "Service credits issued within 30 days of an SLA miss",
    clause: "Where Availability falls below the Service Level in any calendar month, Supplier shall issue a Service Credit to Customer within thirty (30) days after the end of that month, calculated in accordance with Schedule C.",
    target: "≤ 30 days after month end", t: ["<=", 30, "days", "monthly"],
    coverage: "gap", confidence: 0.89,
    gap: "Credits are applied manually by Accounts Payable; nothing links an availability miss to a credit received.",
  }),
  row("MSA-2026-014", {
    id: "OBL-0103", type: "sla", ref: "Sched. B §2.1",
    obligation: "Sev-1 incident response within 15 minutes",
    clause: "For Severity 1 Incidents, Supplier shall acknowledge and commence remediation within fifteen (15) minutes of notification, 24x7x365.",
    target: "≤ 15 min per incident", t: ["<=", 15, "minutes", "per event"],
    metric: "sev1_time_to_ack_p95", dashboard: "ITSM › Major Incidents", platform: "ServiceNow PA",
    source: "ServiceNow.incident (priority = 1)",
    coverage: "partial", confidence: 0.81,
    gap: "Metric is reported at p95; the contract requires every Severity 1 incident to meet the threshold.",
    evidence: [{ kind: "query", label: "PA indicator: P1 time to acknowledge (p95)", captured_at: "2026-11-01" }],
  }),
  row("MSA-2026-014", {
    id: "OBL-0104", type: "sla", ref: "Sched. B §2.3",
    obligation: "Sev-1 resolution or workaround within 4 hours",
    clause: "Supplier shall resolve or provide an accepted workaround for Severity 1 Incidents within four (4) hours of notification.",
    target: "≤ 4 h per incident", t: ["<=", 4, "hours", "per event"],
    metric: "sev1_resolution_breaches", dashboard: "ITSM › Major Incidents", platform: "ServiceNow PA",
    source: "ServiceNow.incident (priority = 1)",
    coverage: "tracked", confidence: 0.92,
    evidence: [
      { kind: "report_export", label: "P1 resolution breach list, Oct 2026", captured_at: "2026-11-01" },
      { kind: "attestation", label: "Service owner sign-off", captured_at: "2026-11-04" },
    ],
  }),
  row("MSA-2026-014", {
    id: "OBL-0105", type: "reporting", ref: "§7.1",
    obligation: "Monthly Service Report by 10th business day",
    clause: "Supplier shall deliver to Customer a Monthly Service Report no later than the tenth (10th) Business Day of each month, covering Availability, Incident volumes, Incident response and resolution times, and Service Credits for the preceding month.",
    target: "≤ BD10 monthly", t: ["<=", 10, "business day of month", "monthly"],
    metric: "vendor_report_received_date", dashboard: "Vendor Management › Deliverables", platform: "ServiceNow VRM",
    source: "ServiceNow.vrm_deliverable",
    coverage: "partial", confidence: 0.77,
    gap: "Receipt is logged, but nothing checks it against the BD10 deadline or whether the report has all required sections.",
    evidence: [{ kind: "ticket", label: "VRM deliverable record, Oct 2026", captured_at: "2026-10-15" }],
  }),
  row("MSA-2026-014", {
    id: "OBL-0106", type: "reporting", ref: "§9.3",
    obligation: "Quarterly SOC 2 Type II bridge letter",
    clause: "Supplier shall deliver a SOC 2 Type II report annually and a bridge letter within thirty (30) days after the end of each calendar quarter.",
    target: "≤ 30 days after quarter end", t: ["<=", 30, "days", "quarterly"],
    coverage: "gap", confidence: 0.92,
    gap: "No metric, report or task tracks whether the bridge letter has been received.",
  }),
  row("MSA-2026-014", {
    id: "OBL-0107", type: "performance_target", ref: "§9.5",
    obligation: "Critical vulns fixed in 15 days, High in 30 days",
    clause: "Supplier shall remediate vulnerabilities rated Critical (CVSS 9.0 or higher) within fifteen (15) days and High (CVSS 7.0 to 8.9) within thirty (30) days of discovery.",
    target: "≤ 15 d critical · ≤ 30 d high", t: ["<=", 15, "days", "per event"],
    metric: "vendor_critical_vuln_age_days", dashboard: "Third-Party Risk › Vendor Security", platform: "Power BI",
    source: "Supplier attestation upload → Snowflake.TPRM.VULN_ATTEST",
    coverage: "partial", confidence: 0.74,
    gap: "Only Critical findings are tracked; the 30-day High-severity commitment is not measured.",
    evidence: [{ kind: "attestation", label: "Q3 vulnerability attestation from Supplier", captured_at: "2026-10-09" }],
  }),
  row("MSA-2026-014", {
    id: "OBL-0108", type: "performance_target", ref: "§10.2",
    obligation: "RPO ≤ 24 h, RTO ≤ 4 h, annual DR test",
    clause: "Supplier shall maintain a Recovery Point Objective of no more than twenty-four (24) hours and a Recovery Time Objective of no more than four (4) hours for the Hosted Services, and shall test its disaster recovery plan at least once in each calendar year.",
    target: "RPO ≤ 24 h · RTO ≤ 4 h · test yearly", t: ["<=", 4, "hours", "annually"],
    coverage: "gap", confidence: 0.86,
    gap: "No DR test results from Supplier have been requested or stored.",
  }),

  /* ---------------- Contact Center SOW #3 ---------------- */
  row("SOW-03", {
    id: "OBL-0201", type: "kpi", ref: "Exhibit A, KPI-1",
    obligation: "Answer 80% of calls within 30 seconds",
    clause: "Service Provider shall answer at least eighty percent (80%) of inbound voice calls within thirty (30) seconds, measured daily and reported monthly.",
    target: "≥ 80% in 30 s, daily", t: [">=", 80, "%", "daily"],
    metric: "service_level_80_30", dashboard: "Customer Ops › Outsourcer Scorecard", platform: "Tableau",
    source: "Genesys Cloud → Databricks.cx.queue_intervals",
    coverage: "tracked", confidence: 0.95,
    evidence: [
      { kind: "report_export", label: "Outsourcer Scorecard, Oct 2026", captured_at: "2026-11-05" },
      { kind: "query", label: "queue_intervals by day, answered ≤ 30 s", captured_at: "2026-11-05" },
    ],
  }),
  row("SOW-03", {
    id: "OBL-0202", type: "kpi", ref: "Exhibit A, KPI-3",
    obligation: "Call abandonment ≤ 5% per month",
    clause: "Service Provider shall maintain a call abandonment rate of no more than five percent (5%) per calendar month.",
    target: "≤ 5% / month", t: ["<=", 5, "%", "monthly"],
    metric: "abandon_rate_monthly", dashboard: "Customer Ops › Outsourcer Scorecard", platform: "Tableau",
    source: "Genesys Cloud → Databricks.cx.queue_intervals",
    coverage: "tracked", confidence: 0.94,
    evidence: [{ kind: "report_export", label: "Outsourcer Scorecard, Oct 2026", captured_at: "2026-11-05" }],
  }),
  row("SOW-03", {
    id: "OBL-0203", type: "kpi", ref: "Exhibit A, KPI-5",
    obligation: "Customer satisfaction ≥ 4.3 / 5",
    clause: "Service Provider shall achieve an average post-interaction customer satisfaction score of at least 4.3 out of 5.0 each calendar month.",
    target: "≥ 4.3 / 5 monthly", t: [">=", 4.3, "score (1–5)", "monthly"],
    metric: "csat_avg_voice", dashboard: "Customer Ops › Voice of Customer", platform: "Qualtrics",
    source: "Qualtrics post-call survey",
    coverage: "partial", confidence: 0.79,
    gap: "The survey covers voice only; chat and email interactions are not included.",
    evidence: [{ kind: "report_export", label: "Qualtrics CSAT export, Oct 2026", captured_at: "2026-11-03" }],
  }),
  row("SOW-03", {
    id: "OBL-0204", type: "kpi", ref: "Exhibit A, KPI-6",
    obligation: "First-contact resolution ≥ 80%",
    clause: "Service Provider shall achieve a First Contact Resolution rate of not less than eighty percent (80%) measured monthly across all inbound channels.",
    target: "≥ 80% / month", t: [">=", 80, "%", "monthly"],
    metric: "fcr_rate_monthly", dashboard: "Customer Ops › Outsourcer Scorecard", platform: "Tableau",
    source: "Genesys Cloud → Databricks.cx.fcr_events",
    coverage: "tracked", confidence: 0.93,
    evidence: [
      { kind: "report_export", label: "Outsourcer Scorecard, Oct 2026", captured_at: "2026-11-05" },
      { kind: "attestation", label: "Customer Ops owner sign-off", captured_at: "2026-11-06" },
    ],
  }),
  row("SOW-03", {
    id: "OBL-0205", type: "reporting", ref: "§7.2",
    obligation: "Monthly Service Report by 5th business day",
    clause: "Service Provider shall deliver the Monthly Service Report no later than the fifth (5th) Business Day of the following month.",
    target: "≤ BD5 monthly", t: ["<=", 5, "business day of month", "monthly"],
    coverage: "gap", confidence: 0.88,
    gap: "The report arrives by email only; there is no timestamped record of when it was received.",
  }),
  row("SOW-03", {
    id: "OBL-0206", type: "performance_target", ref: "§8.4",
    obligation: "Invoice accuracy ≥ 99.5% per quarter",
    clause: "Service Provider shall maintain invoice accuracy of at least 99.5% per calendar quarter.",
    target: "≥ 99.5% / quarter", t: [">=", 99.5, "%", "quarterly"],
    metric: "ap_invoice_dispute_rate", dashboard: "Finance › AP Quality", platform: "Power BI",
    source: "SAP S/4HANA → Snowflake.FIN.AP_DISPUTES",
    coverage: "partial", confidence: 0.72,
    gap: "The dashboard reports dispute rate rather than accuracy, and has no filter for this vendor.",
    evidence: [{ kind: "query", label: "AP_DISPUTES grouped by vendor_id", captured_at: "2026-11-03" }],
  }),
  row("SOW-03", {
    id: "OBL-0207", type: "performance_target", ref: "§5.3",
    obligation: "40 hours of training before agents go live",
    clause: "Service Provider shall ensure each agent completes no fewer than forty (40) hours of Customer-approved training before handling live Customer interactions.",
    target: "≥ 40 h per agent", t: [">=", 40, "hours", "per event"],
    coverage: "gap", confidence: 0.84,
    gap: "Training hours live in Service Provider's learning system; Customer receives no data.",
  }),

  /* ---------------- Data Protection & Privacy Policy v5 ---------------- */
  row("POL-PRV-005", {
    id: "OBL-0301", type: "regulatory", ref: "§5.2",
    obligation: "Answer data subject access requests within 30 days",
    clause: "The Company shall respond to verified data subject access requests within thirty (30) calendar days of receipt.",
    target: "≤ 30 days per request", t: ["<=", 30, "days", "per event"],
    metric: "dsar_on_time_pct", dashboard: "Privacy › Data Subject Requests", platform: "OneTrust",
    source: "OneTrust DSAR module",
    coverage: "tracked", confidence: 0.94,
    evidence: [{ kind: "report_export", label: "DSAR timeliness report, Q3 2026", captured_at: "2026-10-04" }],
  }),
  row("POL-PRV-005", {
    id: "OBL-0302", type: "regulatory", ref: "§6.4",
    obligation: "Notify the regulator of a breach within 72 hours",
    clause: "Where a personal data breach is likely to result in a risk to individuals, the Company shall notify the supervisory authority without undue delay and, where feasible, not later than 72 hours after becoming aware of it.",
    target: "≤ 72 h per breach", t: ["<=", 72, "hours", "per event"],
    metric: "privacy_breach_notify_hours", dashboard: "GRC › Privacy Incidents", platform: "Archer",
    source: "Archer.incidents (category = privacy)",
    coverage: "tracked", confidence: 0.9,
    evidence: [{ kind: "report_export", label: "Q3 2026 privacy incident register", captured_at: "2026-10-04" }],
  }),
  row("POL-PRV-005", {
    id: "OBL-0303", type: "regulatory", ref: "§7.3",
    obligation: "Vendor risk assessment before data access",
    clause: "A privacy and security risk assessment shall be completed and approved before any third party is granted access to Personal Data.",
    target: "Assessment before access (100%)", t: ["=", 100, "%", "per event"],
    metric: "tprm_assessment_completed", dashboard: "Third-Party Risk › Onboarding", platform: "Archer",
    source: "Archer.third_party_assessments",
    coverage: "partial", confidence: 0.76,
    gap: "Completion is tracked, but not compared with the date access was granted.",
    evidence: [{ kind: "query", label: "Assessments approved, last 90 days", captured_at: "2026-11-02" }],
  }),
  row("POL-PRV-005", {
    id: "OBL-0304", type: "regulatory", ref: "§8.1",
    obligation: "Quarterly access reviews for personal-data systems",
    clause: "System owners shall complete a user access review for every system that stores Personal Data at least once each calendar quarter.",
    target: "100% of systems / quarter", t: ["=", 100, "% of systems", "quarterly"],
    metric: "uar_completion_pct", dashboard: "IAM › Access Certifications", platform: "SailPoint",
    source: "SailPoint IdentityNow certifications",
    coverage: "partial", confidence: 0.8,
    gap: "Only 3 of the 5 in-scope systems are connected to SailPoint; the other 2 are reviewed in spreadsheets.",
    evidence: [{ kind: "report_export", label: "Q3 2026 certification campaign summary", captured_at: "2026-10-12" }],
  }),
  row("POL-PRV-005", {
    id: "OBL-0305", type: "regulatory", ref: "§9.2",
    obligation: "Privacy training completion ≥ 95% annually",
    clause: "All workforce members shall complete privacy awareness training annually, and the Company shall maintain a completion rate of at least ninety-five percent (95%).",
    target: "≥ 95% / year", t: [">=", 95, "%", "annually"],
    metric: "privacy_training_completion_pct", dashboard: "HR › Mandatory Training", platform: "Workday",
    source: "Workday Learning",
    coverage: "tracked", confidence: 0.93,
    evidence: [{ kind: "report_export", label: "Mandatory training completion, Oct 2026", captured_at: "2026-11-01" }],
  }),
  row("POL-PRV-005", {
    id: "OBL-0306", type: "regulatory", ref: "§10.1",
    obligation: "Delete customer records within 90 days of retention expiry",
    clause: "Customer records shall be deleted or anonymized within ninety (90) days after the applicable retention period expires.",
    target: "≤ 90 days after expiry", t: ["<=", 90, "days", "per event"],
    coverage: "gap", confidence: 0.83,
    gap: "No system reports records held past their retention date.",
  }),
];

export function summarize(rows) {
  const s = { total: rows.length, tracked: 0, partial: 0, gap: 0 };
  for (const r of rows) s[r.coverage] = (s[r.coverage] || 0) + 1;
  return s;
}

// Markdown → plain text, used before extraction and for matching quotes to clauses.
export function markdownToText(md) {
  return md
    .split("\n")
    .map((l) => l.replace(/^>\s?/, "").replace(/^#{1,6}\s+/, "").replace(/^---+$/, "").replace(/\*\*?([^*]+)\*\*?/g, "$1"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9%.]+/g, " ").trim();
