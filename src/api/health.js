// GET /api/health — reports which integrations are configured (never their values).

import { json } from "../../lib/http.js";
import { nvidiaConfigured, nvidiaKeyName, nvidiaModel } from "../../lib/nvidia.js";
import { supabaseConfigured } from "../../lib/supabase.js";

export function onRequestGet({ env }) {
  return json({
    ok: true,
    // Reports which variable NAME holds the key (never its value), to help spot misnamed secrets.
    nvidia: nvidiaConfigured(env) ? { configured: true, key_name: nvidiaKeyName(env), model: nvidiaModel(env) } : { configured: false },
    supabase: { configured: supabaseConfigured(env) },
  });
}
