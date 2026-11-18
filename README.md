# Clausemap — Contract-to-Metric Traceability

A Cloudflare Pages site and API that discovers contractual and regulatory obligations (KPIs, SLAs, reporting requirements, regulatory commitments) in MSAs, SOWs, vendor contracts and compliance documents, maps them to the enterprise metrics, dashboards and data sources that measure them, and flags gaps with auditable evidence.

- **Landing page** (`/`): product story, animated pipeline diagram, interactive traceability matrix.
- **Console** (`/app`): paste clause text, extract obligations, and browse the traceability matrix.
- **API** (Cloudflare Pages Functions):
  - `POST /api/extract`: `{ text, document_title?, document_type? }` → structured obligations. Uses the NVIDIA LLM API when `NVIDIA_API_KEY` is set; otherwise it uses a rule-based extractor.
  - `GET /api/obligations?coverage=tracked|partial|gap`: traceability rows from Supabase, or bundled sample data when Supabase is not configured.
  - `GET /api/health`: shows which integrations are configured.

## Project layout

```
public/            static site (HTML, CSS, ES modules); deployed as-is, no build step
  index.html       landing page
  app.html         console (served at /app)
  assets/          styles, scripts, sample data, rule-based extractor (shared with the API)
functions/api/     Cloudflare Pages Functions
lib/               server helpers: NVIDIA client + prompt, Supabase REST client
supabase/          SQL migration (schema, traceability view, RLS) and seed data
wrangler.toml      Cloudflare Pages config
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
| `SUPABASE_URL` | secret | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Server-side only; never expose to the browser |

Set the production secrets:

```bash
npx wrangler pages secret put NVIDIA_API_KEY
```

```bash
npx wrangler pages secret put SUPABASE_URL
```

```bash
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
```

## Database (Supabase)

Run `supabase/migrations/20261118000000_traceability.sql` in the Supabase SQL editor (or `supabase db push`), then optionally `supabase/seed.sql`.

Data model: `documents → clauses → obligations ⇄ mappings ⇄ metrics → data_sources`, with `evidence` attached to each mapping and an append-only `audit_log`. The `obligation_traceability` view returns one row per obligation with its best mapping. An obligation with no mapping is reported as a **gap**.

## Deploy to Cloudflare

```bash
npm run deploy
```

Or connect the GitHub repo in the Cloudflare dashboard (Workers & Pages → Create → Pages → Connect to Git) with build command left blank and output directory `public`.

## Next steps

- SharePoint ingestion (Microsoft Graph) to populate `documents` / `clauses` on a schedule (Cron Trigger).
- Write extracted obligations to Supabase and add a metric-matching endpoint that proposes `mappings` from the metric catalog.
- Supabase Auth for analyst sign-in and review/confirm workflow.
