// NVIDIA API Catalog / NIM client (OpenAI-compatible chat completions).
// Docs: https://docs.api.nvidia.com/nim/reference/llm-apis

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "google/gemma-4-31b-it";
// How long one model call may run before falling back. Responses stream, so NVIDIA's gateway
// (which cuts off a silent response after 100 s) no longer limits this. Override with NVIDIA_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = 180000;

// Accepted names for each setting, first match wins. NVIDIA_* is canonical; the others are
// spellings already in use in the Cloudflare dashboard.
const KEY_NAMES = ["NVIDIA_API_KEY", "NVIDIA_KEY", "INVIDIA_API_KEY", "INVIDIA_KEY"];
const pick = (env, names) => names.map((n) => env[n]).find(Boolean);

export const nvidiaKeyName = (env) => KEY_NAMES.find((n) => env[n]) || null;
export const nvidiaModel = (env) => pick(env, ["NVIDIA_MODEL", "INVIDIA_MODEL"]) || DEFAULT_MODEL;
const nvidiaBaseUrl = (env) => pick(env, ["NVIDIA_BASE_URL", "INVIDIA_BASE_URL"]) || DEFAULT_BASE_URL;

export function nvidiaConfigured(env) {
  return Boolean(nvidiaKeyName(env));
}

export async function chat(env, messages, { temperature = 0.1, max_tokens = 4096, timeoutMs } = {}) {
  const base = nvidiaBaseUrl(env);
  const model = nvidiaModel(env);
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pick(env, KEY_NAMES)}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    // Streamed: tokens arrive as they are generated, so a long answer never sits silent long
    // enough for NVIDIA's gateway to time it out.
    body: JSON.stringify({ model, messages, temperature, max_tokens, stream: true }),
    signal: AbortSignal.timeout(timeoutMs || Number(env.NVIDIA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  }).catch((e) => {
    throw new Error(e.name === "TimeoutError" ? `NVIDIA API timed out (model ${model})` : `NVIDIA API unreachable: ${e.message}`);
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`NVIDIA API ${res.status}: ${detail.slice(0, 300)}`);
  }
  try {
    return { model, content: await readStream(res) };
  } catch (e) {
    throw new Error(e.name === "TimeoutError" ? `NVIDIA API timed out (model ${model})` : `NVIDIA stream failed: ${e.message}`);
  }
}

// Collects the text of an OpenAI-style server-sent-event stream ("data: {...}" lines, then "data: [DONE]").
// A server that ignores `stream` and answers with plain JSON is handled too.
async function readStream(res) {
  if (!(res.headers.get("content-type") || "").includes("event-stream")) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", content = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop();
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!line.trim().startsWith("data:")) continue;
      if (data === "[DONE]") {
        reader.cancel().catch(() => {}); // the answer is complete: don't wait for the server to close
        return content;
      }
      try {
        content += JSON.parse(data).choices?.[0]?.delta?.content ?? "";
      } catch {
        /* skip keep-alives and partial lines */
      }
    }
    if (done) return content;
  }
}

// Models sometimes wrap JSON in prose or code fences; pull out the first JSON value.
export function parseJson(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ""); // reasoning models may prefix their thoughts
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("Model returned no JSON");
  const open = candidate[start];
  const close = open === "[" ? "]" : "}";
  const end = candidate.lastIndexOf(close);
  return JSON.parse(candidate.slice(start, end + 1));
}

export const EXTRACTION_SYSTEM_PROMPT = `You are a contracts analyst who extracts measurable obligations from contractual and regulatory text (MSAs, SOWs, vendor contracts, compliance policies).

Return ONLY a JSON object of the form:
{"obligations":[{
  "title": short imperative summary (max 12 words),
  "obligation_type": one of "kpi" | "sla" | "reporting" | "performance_target" | "regulatory",
  "target_comparator": one of ">=", "<=", "=", ">" , "<" or null,
  "target_value": number or null,
  "target_unit": string or null (e.g. "%", "minutes", "business days"),
  "frequency": string or null (e.g. "monthly", "quarterly", "per event"),
  "suggested_metric": snake_case name of a metric that would measure this, or null,
  "source_quote": the exact sentence(s) from the input that create the obligation,
  "confidence": number between 0 and 1
}]}

Rules:
- Only include obligations that can be measured, reported or evidenced.
- source_quote must be copied verbatim from the input. Never invent clauses.
- Convert words to numbers ("fifteen (15) minutes" -> 15, "minutes").
- If nothing qualifies, return {"obligations":[]}.`;
