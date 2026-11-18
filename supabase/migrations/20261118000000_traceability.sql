-- Contract-to-metric traceability schema.
-- documents → clauses → obligations ⇄ mappings ⇄ metrics → data_sources
--                                         └── evidence

create extension if not exists "pgcrypto";

-- Source documents discovered in SharePoint and other repositories.
create table documents (
  id             uuid primary key default gen_random_uuid(),
  document_code  text unique not null,       -- agreement / policy number, e.g. 'MSA-2026-014'
  title          text not null,
  document_type  text not null check (document_type in ('MSA','SOW','Vendor contract','Compliance','Regulatory','Other')),
  repository     text not null,              -- e.g. 'SharePoint / Legal / Vendor MSAs'
  source_url     text,
  counterparty   text,
  effective_date date,
  expiry_date    date,
  body           text,                       -- extracted document text (markdown)
  content_hash   text,                       -- detects re-ingestion of changed files
  ingested_at    timestamptz not null default now()
);

create table clauses (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  clause_ref  text not null,                 -- '§4.2', 'Exhibit A, KPI-6'
  text        text not null,
  page        int,
  created_at  timestamptz not null default now(),
  unique (document_id, clause_ref)
);

create table obligations (
  id                 uuid primary key default gen_random_uuid(),
  obligation_code    text unique not null,   -- human-friendly 'OBL-0142'
  clause_id          uuid not null references clauses(id) on delete cascade,
  title              text not null,
  obligation_type    text not null check (obligation_type in ('kpi','sla','reporting','performance_target','regulatory')),
  target_comparator  text check (target_comparator in ('>=','<=','=','>','<')),
  target_value       numeric,
  target_unit        text,
  frequency          text,
  target_text        text,                   -- human-readable target, e.g. '≥ 99.9% / month'
  gap_note           text,                   -- why an unmapped obligation is not measured
  owner              text,
  source_quote       text not null,          -- verbatim text the obligation was extracted from
  confidence         numeric check (confidence between 0 and 1),
  extracted_by       text not null default 'nvidia',  -- 'nvidia' | 'heuristic' | 'manual'
  model              text,
  review_status      text not null default 'proposed' check (review_status in ('proposed','confirmed','rejected')),
  created_at         timestamptz not null default now()
);

create table data_sources (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,                   -- 'Snowflake.VENDOR.UPTIME_DAILY'
  system    text not null,                   -- 'Snowflake', 'ServiceNow', 'SAP S/4'
  lineage   text,                            -- upstream description, e.g. 'Datadog → Snowflake'
  owner     text
);

create table metrics (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,    -- 'uptime_monthly_pct'
  definition        text,
  platform          text,                    -- 'Power BI', 'Tableau', 'ServiceNow PA'
  dashboard         text,
  dashboard_url     text,
  data_source_id    uuid references data_sources(id),
  refresh_frequency text,
  owner             text
);

create table mappings (
  id            uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references obligations(id) on delete cascade,
  metric_id     uuid not null references metrics(id) on delete cascade,
  coverage      text not null check (coverage in ('tracked','partial')),
  rationale     text,                        -- why the model/analyst believes this metric measures the obligation
  gap_reason    text,                        -- for 'partial': what is missing
  confidence    numeric check (confidence between 0 and 1),
  status        text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (obligation_id, metric_id)
);

create table evidence (
  id          uuid primary key default gen_random_uuid(),
  mapping_id  uuid not null references mappings(id) on delete cascade,
  kind        text not null check (kind in ('report_export','query','screenshot','attestation','ticket')),
  label       text not null,
  uri         text,
  sha256      text,                          -- integrity of stored artefact
  captured_at timestamptz not null default now(),
  captured_by text
);

-- Append-only audit trail for every change an analyst or the pipeline makes.
create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  detail      jsonb
);

create index on clauses (document_id);
create index on obligations (clause_id);
create index on mappings (obligation_id);
create index on mappings (metric_id);
create index on evidence (mapping_id);

-- One row per obligation with its best non-rejected mapping; obligations with none are gaps.
create view obligation_traceability with (security_invoker = true) as
select
  o.obligation_code                                   as obligation_id,
  o.title                                             as obligation,
  o.obligation_type,
  d.document_code                                     as document_id,
  d.title                                             as document_title,
  d.document_type,
  d.repository,
  c.clause_ref,
  c.text                                              as clause_text,
  coalesce(o.target_text,
           concat_ws(' ', o.target_comparator, o.target_value::text, o.target_unit,
                     case when o.frequency is not null then '/ ' || o.frequency end)) as target,
  m.name                                              as metric_name,
  m.dashboard,
  m.platform,
  ds.lineage                                          as data_source,
  coalesce(mp.coverage, 'gap')                        as coverage,
  coalesce(mp.confidence, o.confidence)               as confidence,
  case when mp.id is null then coalesce(o.gap_note, 'No metric mapped to this obligation.') else mp.gap_reason end as gap_reason,
  coalesce((
    select jsonb_agg(jsonb_build_object('kind', e.kind, 'label', e.label, 'captured_at', e.captured_at::date) order by e.captured_at)
    from evidence e where e.mapping_id = mp.id
  ), '[]'::jsonb)                                     as evidence
from obligations o
join clauses c   on c.id = o.clause_id
join documents d on d.id = c.document_id
left join lateral (
  select * from mappings x
  where x.obligation_id = o.id and x.status <> 'rejected'
  order by (x.coverage = 'tracked') desc, x.confidence desc nulls last
  limit 1
) mp on true
left join metrics m       on m.id = mp.metric_id
left join data_sources ds on ds.id = m.data_source_id
where o.review_status <> 'rejected';

-- Row Level Security: the edge API uses the service role key; signed-in users may read.
alter table documents    enable row level security;
alter table clauses      enable row level security;
alter table obligations  enable row level security;
alter table data_sources enable row level security;
alter table metrics      enable row level security;
alter table mappings     enable row level security;
alter table evidence     enable row level security;
alter table audit_log    enable row level security;

create policy "read for authenticated" on documents    for select to authenticated using (true);
create policy "read for authenticated" on clauses      for select to authenticated using (true);
create policy "read for authenticated" on obligations  for select to authenticated using (true);
create policy "read for authenticated" on data_sources for select to authenticated using (true);
create policy "read for authenticated" on metrics      for select to authenticated using (true);
create policy "read for authenticated" on mappings     for select to authenticated using (true);
create policy "read for authenticated" on evidence     for select to authenticated using (true);
create policy "read for authenticated" on audit_log    for select to authenticated using (true);
