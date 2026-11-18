// POST /api/extract  { text: string, document_title?: string, document_type?: string }
// Extracts measurable obligations from clause text with an NVIDIA-hosted LLM.
// Falls back to the rule-based extractor when NVIDIA_API_KEY is not set.

import { json, error } from "../../lib/http.js";
import { chat, parseJson, nvidiaConfigured, EXTRACTION_SYSTEM_PROMPT } from "../../lib/nvidia.js";
import { heuristicExtract } from "../../public/assets/extract-heuristic.js";

const MAX_CHARS = 20000;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, "Body must be JSON");
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return error(400, "`text` is required");
  if (text.length > MAX_CHARS) return error(413, `Text exceeds ${MAX_CHARS} characters`);

  if (!nvidiaConfigured(env)) {
    return json({ engine: "heuristic", model: null, obligations: heuristicExtract(text) });
  }

  const context = [body.document_title && `Document: ${body.document_title}`, body.document_type && `Type: ${body.document_type}`]
    .filter(Boolean)
    .join("\n");

  try {
    const { model, content } = await chat(env, [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\n<document>\n${text}\n</document>` },
    ]);
    const parsed = parseJson(content);
    const obligations = (parsed.obligations || []).map((o, i) => ({ id: `L-${String(i + 1).padStart(3, "0")}`, ...o }));
    return json({ engine: "nvidia", model, obligations });
  } catch (e) {
    // Keep the console usable if the model call fails; tell the client why.
    return json({ engine: "heuristic", model: null, warning: String(e.message || e), obligations: heuristicExtract(text) });
  }
}
