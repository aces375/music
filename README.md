# Clausemap — Contract-to-Metric Traceability

A Cloudflare Worker (static site + API) that discovers contractual and regulatory obligations (KPIs, SLAs, reporting requirements, regulatory commitments) in MSAs, SOWs, vendor contracts and compliance documents, maps them to the enterprise metrics, dashboards and data sources that measure them, and flags gaps with auditable evidence.

- **Landing page** (`/`): product story, animated pipeline diagram, interactive traceability matrix.
- **Console** (`/app`): read the sample documents with traced clauses highlighted, extract obligations from a document or pasted text, and browse the traceability matrix.
- **API** (`src/worker.js`, routes in `src/api/`):
  - `POST /api/extract`: `{ text, document_title?, document_type? }` → structured obligations. Uses the NVIDIA LLM API when `NVIDIA_API_KEY` is set; otherwise it uses a rule-based extractor.
  - `GET /api/obligations?coverage=tracked|partial|gap`: traceability rows from Supabase, or bundled sample data when Supabase is not configured.
  - `GET /api/health`: shows which integrations are configured.

## Sample documents

Three fictional documents stand in for SharePoint until ingestion is built. They live in `public/samples/` and can be read or downloaded from the console:

| ID | Document | Type | What it exercises |
|---|---|---|---|
| `MSA-2026-014` | [Northwind Hosting MSA](public/samples/northwind-hosting-msa.md) | MSA | Availability SLA, incident response, service credits, SOC 2 and DR commitments |
| `SOW-03` | [Contact Center Services SOW #3](public/samples/fabrikam-contact-center-sow-03.md) | SOW | Contact center KPIs (service level, FCR, CSAT), reporting deadlines, invoice accuracy |
| `POL-PRV-005` | [Data Protection & Privacy Policy v5](public/samples/contoso-data-protection-policy-v5.md) | Compliance | Breach notification, data subject requests, access reviews, training, retention |

All parties (Contoso, Northwind, Fabrikam) are fictional. The sample catalog in `public/assets/sample-data.js` traces 21 obligations from these documents (8 tracked, 7 partial, 6 gaps). Each document also contains obligations that are *not* in the catalog, so extraction shows them as "New · not in catalog".

`npm run seed` checks that every catalogued clause is quoted word for word from its document, then regenerates `supabase/seed.sql`, so the database and the sample data stay identical. `npm run check:samples` runs the check only.

## Project layout

```
public/            static site (HTML, CSS, ES modules); deployed as-is, no build step
  index.html       landing page
  app.html         console (served at /app)
  assets/          styles, scripts, sample data, rule-based extractor (shared with the API)
  samples/         the three fictional sample documents (markdown)
src/worker.js      Worker entry: routes /api/* to src/api/; everything else is a static asset
lib/               server helpers: NVIDIA client + prompt, Supabase REST client
supabase/          SQL migration (schema, traceability view, RLS) and generated seed data
scripts/           build-seed.mjs: verifies sample clauses and generates supabase/seed.sql
wrangler.toml      Worker config (name, entry point, ./public as static assets, vars)
```

## Run locally

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars   # optional: add keys
```

```bash
npm run dev                      # http://localhost:8788
```

Everything works without keys. The console shows which engine and data source answered.

## Configure integrations

| Variable | Where | Purpose |
|---|---|---|
| `NVIDIA_API_KEY` | secret | Key from build.nvidia.com (NVIDIA API Catalog / NIM) |
| `NVIDIA_MODEL` | `wrangler.toml` var | Defaults to `meta/llama-3.3-70b-instruct` |
| `NVIDIA_BASE_URL` | `wrangler.toml` var | Defaults to `https://integrate.api.nvidia.com/v1` (or a self-hosted NIM URL) |
| `SUPABASE_URL` | `wrangler.toml` var | `https://<project>.supabase.co` (not secret) |
| `SUPABASE_SECRET_KEY` | secret | `sb_secret_...` key from Supabase → Settings → API Keys. Server-side only. (The legacy `SUPABASE_SERVICE_ROLE_KEY` is still accepted.) |

Set the production secrets:

```bash
npx wrangler secret put NVIDIA_API_KEY
```

```bash
npx wrangler secret put SUPABASE_URL
```

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```

## Database (Supabase)

Run `supabase/migrations/20261118000000_traceability.sql` in the Supabase SQL editor (or `supabase db push`), then `supabase/seed.sql` to load the three sample documents and their obligations.

Data model: `documents → clauses → obligations ⇄ mappings ⇄ metrics → data_sources`, with `evidence` attached to each mapping and an append-only `audit_log`. The `obligation_traceability` view returns one row per obligation with its best mapping. An obligation with no mapping is reported as a **gap**.

## Deploy to Cloudflare

```bash
npm run deploy
```

Or connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Import a repository): project name `clausemap` (it must match `name` in `wrangler.toml`), build command empty, deploy command `npx wrangler deploy`. Every push to `main` then redeploys.

Secrets in production: Worker → Settings → Variables and Secrets.

## Next steps

- SharePoint ingestion (Microsoft Graph) to populate `documents` / `clauses` on a schedule (Cron Trigger).
- Write extracted obligations to Supabase and add a metric-matching endpoint that proposes `mappings` from the metric catalog.
- Supabase Auth for analyst sign-in and review/confirm workflow.
