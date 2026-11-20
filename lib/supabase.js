// Minimal Supabase PostgREST client using fetch, so it runs on Cloudflare's edge
// runtime without bundling @supabase/supabase-js.

// SUPABASE_SECRET_KEY is a new-style secret key (sb_secret_...). The legacy JWT keys
// (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY) still work until Supabase retires them.
function supabaseKey(env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
}

export function supabaseConfigured(env) {
  return Boolean(env.SUPABASE_URL && supabaseKey(env));
}

export function headers(env, extra = {}) {
  const key = supabaseKey(env);
  const h = { apikey: key, "Content-Type": "application/json", ...extra };
  // New keys are not JWTs and are rejected ("Invalid JWT") on the Authorization header.
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
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
