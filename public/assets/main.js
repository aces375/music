import { SAMPLE_ROWS } from "./sample-data.js";
import { mountMatrix } from "./matrix.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- mobile nav ---------- */
const nav = document.getElementById("nav");
const menuBtn = nav.querySelector(".nav__menu");
menuBtn.addEventListener("click", () => {
  const open = nav.toggleAttribute("data-open");
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
nav.querySelectorAll(".nav__links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.removeAttribute("data-open");
    menuBtn.setAttribute("aria-expanded", "false");
  }),
);

/* ---------- diagram: scale fixed 960×540 stage to its container ---------- */
const scaleBox = document.getElementById("diagram-scale");
const stage = document.getElementById("stage");
function fit() {
  const s = Math.min(1, scaleBox.clientWidth / 960);
  stage.style.transform = `scale(${s})`;
  scaleBox.style.height = `${540 * s}px`;
}
new ResizeObserver(fit).observe(scaleBox);
fit();

/* ---------- diagram: pipeline storyline ---------- */
const steps = [...document.querySelectorAll("#steps .step")];
const roles = [...document.querySelectorAll("#roles li")];
const repos = [...document.querySelectorAll("#repos .repo")];
const ctx = [...document.querySelectorAll("#ctx li")];
const term = document.getElementById("term");
const board = document.getElementById("board");
const counts = { tracked: 0, partial: 0, gap: 0 };

const STORIES = [
  {
    repo: 1, role: 0, ctx: [0, 2], result: "tracked",
    lines: [
      ["› scan sp://legal/vendor-msas", ""],
      ["  northwind-hosting-msa.md", "dim"],
      ["› extract §4.2", ""],
      ["  SLA availability ≥ 99.9%/mo", "dim"],
      ["› map uptime_monthly_pct 0.96", ""],
      ["  ✓ tracked · 2 evidence", "ok"],
    ],
  },
  {
    repo: 2, role: 3, ctx: [1], result: "gap",
    lines: [
      ["› scan sp://ops/outsourcing", ""],
      ["  fabrikam-contact-center-sow", "dim"],
      ["› extract §7.2", ""],
      ["  service report ≤ BD5 monthly", "dim"],
      ["› map … 0 candidates", ""],
      ["  ✗ gap raised → owner notified", "bad"],
    ],
  },
  {
    repo: 3, role: 1, ctx: [0, 3], result: "partial",
    lines: [
      ["› scan sp://risk/policies", ""],
      ["  data-protection-policy-v5.md", "dim"],
      ["› extract §8.1", ""],
      ["  access reviews quarterly", "dim"],
      ["› map uar_completion_pct 0.80", ""],
      ["  ~ partial · 3 of 5 systems", "bad"],
    ],
  },
  {
    repo: 0, role: 2, ctx: [0, 1, 2], result: "tracked",
    lines: [
      ["› scan sp://ops/outsourcing", ""],
      ["  fabrikam-contact-center-sow", "dim"],
      ["› extract Exhibit A KPI-6", ""],
      ["  FCR ≥ 80% monthly", "dim"],
      ["› map fcr_rate_monthly 0.93", ""],
      ["  ✓ tracked · 2 evidence", "ok"],
    ],
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const only = (els, i) => els.forEach((el, j) => el.classList.toggle("is-on", Array.isArray(i) ? i.includes(j) : i === j));
const setRepo = (i) => repos.forEach((el, j) => el.classList.toggle("repo--hot", i === j));

function addChip(kind) {
  counts[kind]++;
  const col = board.querySelector(`.col--${{ tracked: "ok", partial: "warn", gap: "bad" }[kind]}`);
  const chips = col.querySelectorAll(".chip");
  if (chips.length >= 4) chips[0].remove();
  const chip = document.createElement("div");
  chip.className = "chip";
  col.appendChild(chip);
  board.querySelector(`[data-n="${kind}"]`).textContent = counts[kind];
}

async function typeLine(text, cls) {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  term.appendChild(line);
  for (let i = 0; i <= text.length; i += 2) {
    line.textContent = text.slice(0, i);
    await wait(14);
  }
  line.textContent = text;
}

async function storyline() {
  // seed board so it never looks empty
  ["tracked", "tracked", "partial", "gap", "tracked"].forEach(addChip);
  let n = 0;
  for (;;) {
    const s = STORIES[n++ % STORIES.length];
    term.textContent = "";
    steps.forEach((el) => el.classList.remove("is-on", "is-done"));
    only(ctx, []);
    setRepo(s.repo);
    only(roles, s.role);
    for (let k = 0; k < 4; k++) {
      steps.forEach((el, j) => {
        el.classList.toggle("is-on", j === k);
        el.classList.toggle("is-done", j < k);
      });
      if (k === 2) only(ctx, s.ctx);
      // discover → lines 0-1, extract → 2-3, map → 4, validate → 5
      const range = [[0, 1], [2, 3], [4], [5]][k];
      for (const idx of range) await typeLine(...s.lines[idx]);
      if (k === 3) addChip(s.result);
      await wait(650);
    }
    await wait(1400);
  }
}

if (reduceMotion) {
  ["tracked", "tracked", "partial", "gap", "tracked"].forEach(addChip);
  only(steps, 2);
  only(ctx, [0, 2]);
  STORIES[0].lines.forEach(([t, c]) => {
    const d = document.createElement("div");
    if (c) d.className = c;
    d.textContent = t;
    term.appendChild(d);
  });
} else {
  storyline();
}

/* ---------- matrix ---------- */
mountMatrix({
  rows: SAMPLE_ROWS,
  statsEl: document.getElementById("stats"),
  rowsEl: document.getElementById("matrix-rows"),
  filterEls: [...document.querySelectorAll(".filter")],
  limit: 8,
});

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }),
  { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
