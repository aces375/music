// NVIDIA API Catalog / NIM client (OpenAI-compatible chat completions).
// Docs: https://docs.api.nvidia.com/nim/reference/llm-apis

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

export function nvidiaConfigured(env) {
  return Boolean(env.NVIDIA_API_KEY);
}

export async function chat(env, messages, { temperature = 0.1, max_tokens = 4096 } = {}) {
  const base = env.NVIDIA_BASE_URL || DEFAULT_BASE_URL;
  const model = env.NVIDIA_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens, stream: false }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`NVIDIA API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return { model, content: data.choices?.[0]?.message?.content ?? "" };
}

// Models sometimes wrap JSON in prose or code fences; pull out the first JSON value.
export function parseJson(text) {
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
