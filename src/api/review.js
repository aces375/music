// POST /api/review — TEMPORARY. Lets the edge-case review agents use the NVIDIA key stored
// as a Cloudflare secret without the key ever leaving Cloudflare. Gated by a token whose
// SHA-256 is REVIEW_TOKEN_SHA256 (wrangler.toml). Removed again after the review.

import { json, error } from "../../lib/http.js";
import { chat, nvidiaConfigured } from "../../lib/nvidia.js";

const MAX_CHARS = 60000;
const MAX_TOKENS = 3000;
// Current chat models that may be tried during the review (the configured model was retired).
const MODELS = new Set(["nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/nemotron-3-ultra-550b-a55b", "z-ai/glm-5.3-flash", "minimaxai/minimax-m3.1-flash", "moonshotai/kimi-k3.1-pro", "mistralai/mistral-large-4-1t-a52b"]);

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Compare two equal-length hex digests without an early exit.
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  const expected = (env.REVIEW_TOKEN_SHA256 || "").toLowerCase();
  const token = request.headers.get("X-Review-Token") || "";
  if (!expected || !token || !same(await sha256Hex(token), expected)) return error(401, "Unauthorized");
  if (!nvidiaConfigured(env)) return error(503, "NVIDIA is not configured");

  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, "Body must be JSON");
  }
  const messages = Array.isArray(body.messages) ? body.messages : null;
  const valid = messages?.length && messages.every((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m.content === "string");
  if (!valid) return error(400, "`messages` must be an array of {role, content}");
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) return error(413, `Messages exceed ${MAX_CHARS} characters`);
  const max_tokens = Math.min(Number(body.max_tokens) || 1500, MAX_TOKENS);

  try {
    const model = MODELS.has(body.model) ? body.model : undefined;
    const out = await chat(model ? { ...env, NVIDIA_MODEL: model } : env, messages, { max_tokens, temperature: 0.2, timeoutMs: 90000 });
    return json({ model: out.model, content: out.content });
  } catch (e) {
    return error(502, String(e.message || e));
  }
}
