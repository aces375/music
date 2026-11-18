// Minimal Supabase PostgREST client using fetch, so it runs on Cloudflare's edge
// runtime without bundling @supabase/supabase-js.

export function supabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY));
}

function headers(env, extra = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function select(env, table, query = "select=*") {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers(env) });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function insert(env, table, rows) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(env, { Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
