-- Small seed so /api/obligations returns tracked, partial and gap rows from a real database.

with d as (
  insert into documents (title, document_type, repository, counterparty)
  values ('Northwind Hosting MSA', 'MSA', 'SharePoint / Legal / Vendor MSAs', 'Northwind Hosting')
  returning id
), c as (
  insert into clauses (document_id, clause_ref, text)
  select id, ref, txt from d, (values
    ('§4.2', 'Supplier shall ensure the Hosted Services are Available at least 99.9% of each calendar month, excluding Scheduled Maintenance notified no less than five (5) Business Days in advance.'),
    ('Sched. B §2.1', 'For Severity 1 Incidents, Supplier shall acknowledge and commence remediation within fifteen (15) minutes of notification, 24x7x365.'),
    ('§9.3', 'Vendor shall deliver a SOC 2 Type II report annually and a bridge letter within thirty (30) days after the end of each calendar quarter.')
  ) as v(ref, txt)
  returning id, clause_ref, text
)
insert into obligations (obligation_code, clause_id, title, obligation_type, target_comparator, target_value, target_unit, frequency, source_quote, confidence, extracted_by)
select code, c.id, title, typ, cmp, val, unit, freq, c.text, conf, 'manual'
from c join (values
  ('§4.2',          'OBL-0142', 'Monthly platform availability ≥ 99.9%',       'sla',       '>=', 99.9, '%',       'monthly',   0.96),
  ('Sched. B §2.1', 'OBL-0143', 'Sev-1 incident response within 15 minutes',   'sla',       '<=', 15,   'minutes', 'per event', 0.81),
  ('§9.3',          'OBL-0207', 'Quarterly SOC 2 Type II bridge letter',        'reporting', '<=', 30,   'days',    'quarterly', 0.92)
) as v(ref, code, title, typ, cmp, val, unit, freq, conf) on v.ref = c.clause_ref;

insert into data_sources (name, system, lineage) values
  ('Snowflake.VENDOR.UPTIME_DAILY', 'Snowflake',  'Datadog → Snowflake.VENDOR.UPTIME_DAILY'),
  ('ServiceNow.incident',           'ServiceNow', 'ServiceNow.incident (priority = 1)');

insert into metrics (name, platform, dashboard, data_source_id, refresh_frequency)
select 'uptime_monthly_pct', 'Power BI', 'Vendor Performance › Hosting SLA', id, 'daily' from data_sources where system = 'Snowflake'
union all
select 'sev1_time_to_ack_p95', 'ServiceNow PA', 'ITSM › Major Incidents', id, 'hourly' from data_sources where system = 'ServiceNow';

insert into mappings (obligation_id, metric_id, coverage, rationale, gap_reason, confidence, status)
select o.id, m.id, 'tracked', 'Metric computes monthly availability excluding maintenance windows.', null, 0.96, 'confirmed'
from obligations o, metrics m where o.obligation_code = 'OBL-0142' and m.name = 'uptime_monthly_pct'
union all
select o.id, m.id, 'partial', 'Measures Sev-1 acknowledgement time.', 'Metric is measured at p95; contract requires every incident to meet the threshold.', 0.81, 'proposed'
from obligations o, metrics m where o.obligation_code = 'OBL-0143' and m.name = 'sev1_time_to_ack_p95';

insert into evidence (mapping_id, kind, label)
select mp.id, 'report_export', 'Oct 2026 SLA report (PDF)'
from mappings mp join obligations o on o.id = mp.obligation_id where o.obligation_code = 'OBL-0142';
