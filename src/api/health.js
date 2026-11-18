// GET /api/health — reports which integrations are configured (never their values).

import { json } from "../../lib/http.js";
import { nvidiaConfigured } from "../../lib/nvidia.js";
import { supabaseConfigured } from "../../lib/supabase.js";

export function onRequestGet({ env }) {
  return json({
    ok: true,
    nvidia: nvidiaConfigured(env) ? { configured: true, model: env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct" } : { configured: false },
    supabase: { configured: supabaseConfigured(env) },
  });
}
