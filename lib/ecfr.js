// eCFR (Electronic Code of Federal Regulations) — free, no API key.
// Docs: https://www.ecfr.gov/developers/documentation/api/v1
// Fetches one regulation section as plain text so it can be run through obligation extraction.

const BASE = "https://www.ecfr.gov/api/versioner/v1";

// Ready-made sections that create measurable compliance obligations.
export const PRESETS = [
  { id: "ftc-safeguards", title: 16, part: 314, section: "314.4", label: "FTC Safeguards Rule — information security program (16 CFR 314.4)" },
  { id: "hipaa-breach", title: 45, part: 164, section: "164.404", label: "HIPAA — breach notification to individuals (45 CFR 164.404)" },
  { id: "reg-sp", title: 17, part: 248, section: "248.30", label: "SEC Regulation S-P — customer information safeguards (17 CFR 248.30)" },
];

// The versioner API requires compressed responses and a dated snapshot.
const get = (url) => fetch(url, { headers: { "Accept-Encoding": "gzip", "User-Agent": "Clausemap/1.0" }, cf: { cacheTtl: 86400 } });

async function latestDate(title) {
  const res = await get(`${BASE}/titles.json`);
  if (!res.ok) throw new Error(`eCFR titles ${res.status}`);
  const t = (await res.json()).titles.find((x) => x.number === title);
  if (!t) throw new Error(`Unknown CFR title ${title}`);
  return t.up_to_date_as_of;
}

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// eCFR XML → { heading, text } with one paragraph per <P>.
export function xmlToText(xml) {
  const heading = decode((xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/) || [, ""])[1].replace(/<[^>]+>/g, "").trim());
  const paras = [...xml.matchAll(/<P>([\s\S]*?)<\/P>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()));
  return { heading, text: paras.filter(Boolean).join("\n\n") };
}

export async function fetchSection({ title, part, section }) {
  const date = await latestDate(title);
  const url = `${BASE}/full/${date}/title-${title}.xml?part=${encodeURIComponent(part)}&section=${encodeURIComponent(section)}`;
  const res = await get(url);
  if (!res.ok) throw new Error(`eCFR ${res.status} for ${title} CFR ${section}`);
  const { heading, text } = xmlToText(await res.text());
  if (!text) throw new Error(`No text found for ${title} CFR ${section}`);
  return {
    citation: `${title} CFR ${section}`,
    heading,
    as_of: date,
    text,
    source_url: `https://www.ecfr.gov/current/title-${title}/section-${section}`,
  };
}
