// Presenter for the capstone deck at /deck.
// Loads the same slide files as the Slides artifact (deck.json order + slides/<id>.html),
// scales the 1920×1080 canvas to the window, and adds keyboard, full screen and notes.

const IMAGES = {
  // uploaded artifact assets → copies served with the site
  f532d735128544767883bc20da29e82e: "/deck/img/home.jpg",
  f60954ec591f2bbd09791bad58e416b6: "/deck/img/results.jpg",
  e982f6c277c8bcf2aa45ede9a47cd6fa: "/deck/img/due.jpg",
  "01559f288a00c3504cc6408be68dfce2": "/deck/img/reader.jpg",
};

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const viewport = $("viewport");
let slides = [];
let index = 0;

async function load() {
  const deck = await fetch("/deck/deck.json").then((r) => r.json());
  document.title = `${deck.title} — Clausemap`;
  const htmls = await Promise.all(deck.order.map((id) => fetch(`/deck/slides/${id}`).then((r) => (r.ok ? r.text() : ""))));
  stage.innerHTML = htmls
    .join("\n")
    .replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => IMAGES[id] || m);
  slides = [...stage.querySelectorAll(":scope > section")];
  slides.forEach((s, i) => {
    s.setAttribute("role", "group");
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`);
  });
  const fromHash = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(fromHash) ? fromHash - 1 : 0, false);
  fit();
}

function go(i, push = true) {
  if (!slides.length) return;
  index = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, n) => {
    const on = n === index;
    s.classList.toggle("is-current", on);
    s.setAttribute("aria-hidden", String(!on));
  });
  $("count").textContent = `${index + 1} / ${slides.length}`;
  $("prev").disabled = index === 0;
  $("next").disabled = index === slides.length - 1;
  if (push) history.replaceState(null, "", `#${index + 1}`);
  renderNotes();
}

function renderNotes() {
  const aside = slides[index]?.querySelector(":scope > aside");
  const text = aside ? aside.textContent.trim() : "No notes for this slide.";
  const body = $("notes-body");
  body.textContent = "";
  const m = text.match(/^(CAPSTONE ASK:[^\n]*)\n*([\s\S]*)$/);
  if (m) {
    const ask = document.createElement("span");
    ask.className = "ask";
    ask.textContent = m[1];
    body.append(ask, m[2]);
  } else {
    body.textContent = text;
  }
  $("notes-slide").textContent = `slide ${index + 1}`;
}

function fit() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  const s = Math.min(w / 1920, h / 1080);
  const x = (w - 1920 * s) / 2;
  const y = (h - 1080 * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

function toggleNotes(force) {
  const panel = $("notes");
  const show = force ?? panel.hidden;
  panel.hidden = !show;
  $("notes-btn").setAttribute("aria-pressed", String(show));
}

async function toggleFull() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* fullscreen not allowed (e.g. inside an iframe): keep the windowed view */
  }
}

document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("is-full", Boolean(document.fullscreenElement));
  requestAnimationFrame(fit);
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); go(index + 1); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); go(index - 1); }
  else if (k === "Home") go(0);
  else if (k === "End") go(slides.length - 1);
  else if (k === "f" || k === "F") toggleFull();
  else if (k === "n" || k === "N") toggleNotes();
  else if (/^[1-9]$/.test(k)) go(Number(k) - 1);
  hideHint();
});

// tap/click: right two-thirds advances, left third goes back (ignores the bar and notes)
viewport.addEventListener("click", (e) => {
  const x = e.clientX / window.innerWidth;
  go(x < 1 / 3 ? index - 1 : index + 1);
  hideHint();
});

// swipe on touch screens
let touchX = null;
viewport.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
viewport.addEventListener("touchend", (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
  touchX = null;
});

// in full screen, reveal the bar when the pointer nears the bottom edge
document.addEventListener("mousemove", (e) => {
  document.body.classList.toggle("show-bar", e.clientY > window.innerHeight - 70);
});

$("prev").addEventListener("click", () => go(index - 1));
$("next").addEventListener("click", () => go(index + 1));
$("notes-btn").addEventListener("click", () => toggleNotes());
$("full-btn").addEventListener("click", toggleFull);
window.addEventListener("resize", fit);
window.addEventListener("hashchange", () => {
  const n = parseInt(location.hash.slice(1), 10);
  if (Number.isFinite(n) && n - 1 !== index) go(n - 1, false);
});

let hintTimer = setTimeout(hideHint, 5000);
function hideHint() {
  clearTimeout(hintTimer);
  $("hint").classList.add("is-gone");
}

load();
