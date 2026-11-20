// Rule-based obligation extractor.
// Runs when no NVIDIA API key is configured (server) or the API is unreachable (browser),
// so the console stays usable in local development. Output matches the LLM schema.

const MODAL = /\b(shall|must|agrees? to|is required to|undertakes? to)\b/i;
const NUM_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|forty-five|sixty|ninety";
const NUMERIC = new RegExp(`(\\d+(?:\\.\\d+)?\\s?%|\\(\\d+\\)|\\b\\d+(?:\\.\\d+)?\\s?(?:seconds?|minutes?|hours?|days?|business days?|weeks?|months?)\\b|\\b(?:${NUM_WORDS})\\b)`, "i");
// Strict verb forms, so nouns like "Service Provider" or "Service Delivery Manager" don't count.
const REPORTING = /\b(report(s|ed|ing)?|submit(s|ted)?|notif(y|ies|ied)|certif(y|ies)|attest(s|ed)?)\b|\b(deliver|provide)(s|d|ed)?\b[^.]*\b(report|letter|plan|summary|results|evidence)\b/i;
const CADENCE = /\b(each|every|per)\s+(calendar\s+)?(day|week|month|quarter|year)\b|\b(daily|weekly|monthly|quarterly|annually|yearly)\b|\bat least (once|annually)\b/i;
const GATE = /\bbefore (any|being|handling|granting)\b|\bprior to\b/i;
const REGULATORY = /\b(regulat\w*|supervisory|authority|GDPR|HIPAA|SOX|PCI|statut\w*)\b/i;
const SLA = /\b(availab\w*|uptime|incidents?|severity|acknowledge|respond|response time)\b/i;

const FREQUENCIES = [
  [/\b(each|every|per)\s+(calendar\s+)?month|monthly|of the following month\b/i, "monthly"],
  [/\b(each|every|per)\s+(calendar\s+)?quarter|quarterly\b/i, "quarterly"],
  [/\b(each|every|per)\s+(calendar\s+)?year|annual(ly)?\b/i, "annually"],
  [/\b(each|every|per)\s+week|weekly|each (monday|tuesday|wednesday|thursday|friday)\b/i, "weekly"],
  [/\b(each|every|per)\s+day|daily\b/i, "daily"],
  [/\b(per|each|any|for)\s+(severity \d\s+)?(incident|event|breach|request|occurrence)s?\b/i, "per event"],
];

const UNIT = "seconds?|minutes?|hours?|business days?|calendar days?|days?|weeks?|months?|interactions?";
const MAX_WORDS = /(no more than|not more than|not exceed|up to|less than|below|within|no later than|not later than|maximum of)/i;

function splitSentences(text) {
  return text
    .split(/\n\s*\n/) // paragraphs first, so clause headings never merge
    .flatMap((p) => p.replace(/\s+/g, " ").split(/(?<=[.;])\s+(?=[A-Z0-9(])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function classify(s, documentType) {
  if (REGULATORY.test(s) || /compliance|regulatory|policy/i.test(documentType || "")) return "regulatory";
  if (SLA.test(s)) return "sla";
  if (/%/.test(s)) return "kpi";
  if (REPORTING.test(s)) return "reporting";
  return "performance_target";
}

function target(s) {
  const score = s.match(/(\d+(?:\.\d+)?)\s+out of\s+(\d+(?:\.\d+)?)/i);
  if (score) return { comparator: ">=", value: Number(score[1]), unit: `out of ${score[2]}` };

  const pct = s.match(/([^.]{0,40}?)(\d+(?:\.\d+)?)\s?%/);
  if (pct) return { comparator: MAX_WORDS.test(pct[1]) && !/at least|not less than|no less than/i.test(pct[1]) ? "<=" : ">=", value: Number(pct[2]), unit: "%" };

  const ord = s.match(/(\d+)(?:st|nd|rd|th)\)?\s*business day/i);
  if (ord) return { comparator: "<=", value: Number(ord[1]), unit: "business day of period" };

  const min = s.match(new RegExp(`(at least|no fewer than|not less than|no less than|minimum of)[^.]{0,25}?\\(?(\\d+)\\)?\\s*(${UNIT})`, "i"));
  if (min) return { comparator: ">=", value: Number(min[2]), unit: min[3].toLowerCase() };

  const dur = s.match(new RegExp(`${MAX_WORDS.source}[^.]{0,30}?\\(?(\\d+)\\)?\\s*(${UNIT})`, "i"));
  if (dur) return { comparator: "<=", value: Number(dur[2]), unit: dur[3].toLowerCase() };

  return { comparator: null, value: null, unit: null };
}

function title(s) {
  const m = s.match(MODAL);
  const rest = m ? s.slice(m.index + m[0].length) : s;
  const t = rest.replace(/^[\s,]+/, "").replace(/^(ensure|be)\s+(that\s+)?/i, "").split(/[,;]/)[0].replace(/\.$/, "").trim();
  const words = t.split(" ").slice(0, 12).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function heuristicExtract(text, { documentType } = {}) {
  const out = [];
  splitSentences(text).forEach((s) => {
    if (!MODAL.test(s)) return;
    const numeric = NUMERIC.test(s);
    const cadence = CADENCE.test(s);
    const measurable = numeric || cadence || REPORTING.test(s) || GATE.test(s);
    if (!measurable) return;
    const t = target(s);
    const freq = FREQUENCIES.find(([re]) => re.test(s));
    out.push({
      id: `H-${String(out.length + 1).padStart(3, "0")}`,
      title: title(s),
      obligation_type: classify(s, documentType),
      target_comparator: t.comparator,
      target_value: t.value,
      target_unit: t.unit,
      frequency: freq ? freq[1] : null,
      suggested_metric: null,
      source_quote: s,
      confidence: Math.round(Math.min(0.95, 0.45 + (numeric ? 0.2 : 0) + (t.value != null ? 0.15 : 0) + (freq ? 0.1 : 0) + (cadence ? 0.05 : 0)) * 100) / 100,
    });
  });
  return out;
}
