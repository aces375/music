// Rule-based obligation extractor.
// Runs when no NVIDIA API key is configured (server) or the API is unreachable (browser),
// so the console stays usable in local development. Output matches the LLM schema.

const MODAL = /\b(shall|must|will|agrees? to|is required to|undertakes? to)\b/i;
const NUMERIC = /(\d+(?:\.\d+)?\s?%|\(\d+\)|\b\d+(?:\.\d+)?\s?(?:minutes?|mins?|hours?|hrs?|days?|business days?|weeks?|months?)\b|\b(?:one|two|three|five|ten|fifteen|thirty|sixty|ninety)\b)/i;
const REPORTING = /\b(report|deliver|submit|provide|notify|notification|certif|attest|audit)\w*/i;
const REGULATORY = /\b(regulat\w*|supervisory|authority|GDPR|HIPAA|SOX|PCI|statut\w*|law)\b/i;
const SLA = /\b(availab\w*|uptime|respon\w*|resolution|resolve|acknowledge|incident|severity)\b/i;

const FREQUENCIES = [
  [/\b(each|every|per|of the following)\s+(calendar\s+)?month|monthly\b/i, "monthly"],
  [/\b(each|every|per)\s+(calendar\s+)?quarter|quarterly\b/i, "quarterly"],
  [/\b(each|every|per)\s+year|annual(ly)?\b/i, "annually"],
  [/\b(each|every|per)\s+week|weekly\b/i, "weekly"],
  [/\b(each|every|per)\s+day|daily\b/i, "daily"],
  [/\b(per|each)\s+(incident|event|breach|occurrence)|\bfor (each|every)\b/i, "per event"],
];

function splitSentences(text) {
  return text
    .split(/\n\s*\n/) // paragraphs first, so clause headings never merge
    .flatMap((p) => p.replace(/\s+/g, " ").split(/(?<=[.;])\s+(?=[A-Z0-9(])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function classify(s) {
  if (REGULATORY.test(s)) return "regulatory";
  if (SLA.test(s)) return "sla";
  if (REPORTING.test(s)) return "reporting";
  if (/%/.test(s)) return "kpi";
  return "performance_target";
}

function target(s) {
  const pct = s.match(/(not less than|at least|no less than|minimum of|≥)?[^.]{0,40}?(\d+(?:\.\d+)?)\s?%/i);
  if (pct) return { comparator: ">=", value: Number(pct[2]), unit: "%" };
  const dur = s.match(/(within|no later than|not later than|not more than|less than)[^.]{0,30}?\(?(\d+)\)?\s*(business days?|days?|hours?|minutes?|weeks?)/i);
  if (dur) return { comparator: "<=", value: Number(dur[2]), unit: dur[3].toLowerCase() };
  const ord = s.match(/(\d+)(?:st|nd|rd|th)\)?\s*business day/i);
  if (ord) return { comparator: "<=", value: Number(ord[1]), unit: "business day of period" };
  return { comparator: null, value: null, unit: null };
}

function title(s) {
  const m = s.match(MODAL);
  const rest = m ? s.slice(m.index + m[0].length) : s;
  const t = rest.replace(/^[\s,]+/, "").split(/[,;]/)[0].trim();
  const words = t.split(" ").slice(0, 12).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function heuristicExtract(text) {
  const out = [];
  splitSentences(text).forEach((s, i) => {
    if (!MODAL.test(s)) return;
    const numeric = NUMERIC.test(s);
    const reporting = REPORTING.test(s);
    if (!numeric && !reporting) return;
    const t = target(s);
    const freq = FREQUENCIES.find(([re]) => re.test(s));
    out.push({
      id: `H-${String(i + 1).padStart(3, "0")}`,
      title: title(s),
      obligation_type: classify(s),
      target_comparator: t.comparator,
      target_value: t.value,
      target_unit: t.unit,
      frequency: freq ? freq[1] : null,
      suggested_metric: null,
      source_quote: s,
      confidence: Math.min(0.95, 0.45 + (numeric ? 0.25 : 0) + (t.value != null ? 0.15 : 0) + (freq ? 0.1 : 0)),
    });
  });
  return out;
}
