// ---- Settings you can tweak ----
const PRESET_WIDTH = { short: 40, medium: 80, long: 120 }; // Simple mode: dashes per line
const BAR_WIDTH = { short: 12, medium: 20, long: 28 };     // Advanced mode: dashes per measure
const LEGEND_TEXT = "h = hammer-on   p = pull-off   b = bend   / = slide";

let selectedSize = "medium";
let mode = "simple"; // "simple" | "advanced"

// ---- DOM ----
const modeSimpleBtn = document.getElementById("modeSimple");
const modeAdvancedBtn = document.getElementById("modeAdvanced");
const advancedMeasures = document.getElementById("advancedMeasures");
const widthRow = document.getElementById("widthRow"); 

const sizeBtns = Array.from(document.querySelectorAll(".sizeBtn"));
const barsInput = document.getElementById("bars");

const tuningSelect = document.getElementById("tuning");
const customTuningWrap = document.getElementById("customTuningWrap");
const customTuningInput = document.getElementById("customTuning");
const tuningWarn = document.getElementById("tuningWarn");

const legendChk = document.getElementById("legend");
const titleOnChk = document.getElementById("titleOn");
const titleInput = document.getElementById("title");

// Optional UI element (may not exist if you removed it)
const autoCopyChk = document.getElementById("autoCopy"); 

const copyBtn = document.getElementById("copy");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");

// ---- Helpers ----
function isAutoCopyEnabled() {
  return !!autoCopyChk && autoCopyChk.checked; 
}

function setStatus(msg, ms = 1400) {
  statusEl.textContent = msg;
  if (msg) setTimeout(() => (statusEl.textContent = ""), ms);
}

function normalizeTuning(str) {
  const parts = str.split(/\s+/).filter(Boolean);
  return parts.length === 6 ? parts : null; // low->high
}

function getTuningLabels() {
  const t = tuningSelect.value;

  if (t === "standard") return ["E","A","D","G","B","e"];
  if (t === "dropd")    return ["D","A","D","G","B","e"];
  if (t === "halfdown") return ["Eb","Ab","Db","Gb","Bb","eb"];

  // Custom
  const parsed = normalizeTuning(customTuningInput.value.trim());
  return parsed; // may be null
}

function buildLineBars(size, bars) {
  const perBar = BAR_WIDTH[size] ?? BAR_WIDTH.medium;
  const chunk = "-".repeat(perBar);
  return "|" + Array.from({ length: bars }, () => chunk + "|").join("");
}

function buildLineSimple(size) {
  const w = PRESET_WIDTH[size] ?? PRESET_WIDTH.medium;
  return "|" + "-".repeat(w) + "|";
}

function buildTabText() {
  // Tuning
  tuningWarn.textContent = "";
  const tuning = getTuningLabels(); // low->high or null

  if (tuningSelect.value === "custom" && !tuning) {
    tuningWarn.textContent = "Custom tuning must be 6 notes like: E A D G B e";
  }

  // Tab order should be high->low
  const labels = tuning
    ? [tuning[5], tuning[4], tuning[3], tuning[2], tuning[1], tuning[0]]
    : ["e","B","G","D","A","E"];

  // Line content
  let line;
  if (mode === "advanced") {
    const bars = Math.max(1, Math.min(16, parseInt(barsInput.value || "4", 10)));
    line = buildLineBars(selectedSize, bars);
  } else {
    line = buildLineSimple(selectedSize);
  }

  const lines = labels.map(s => `${s}${line}`);

  // Title + legend
  const includeTitle = titleOnChk.checked;
  const title = titleInput.value.trim();
  const includeLegend = legendChk.checked;

  let out = "";
  if (includeTitle) out += (title || "(notes)") + "\n\n";
  out += lines.join("\n");
  if (includeLegend) out += "\n\n" + LEGEND_TEXT;

  return out;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function render({ copy = false } = {}) {
  const text = buildTabText();
  preview.value = text;

  if (copy) {
    copyText(text)
      .then(() => setStatus("Copied ✅"))
      .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
  }
}

function setMode(next) {
  mode = next;

  const isSimple = mode === "simple";
  modeSimpleBtn.classList.toggle("active", isSimple);
  modeAdvancedBtn.classList.toggle("active", !isSimple);

  modeSimpleBtn.setAttribute("aria-selected", isSimple ? "true" : "false");
  modeAdvancedBtn.setAttribute("aria-selected", !isSimple ? "true" : "false");

  // Show/hide measures + width preset
  advancedMeasures.style.display = isSimple ? "none" : "grid";
  if (widthRow) widthRow.style.display = isSimple ? "grid" : "none"; // ✅ safe

  // Bars default if switching to advanced
  if (!isSimple && (!barsInput.value || parseInt(barsInput.value, 10) < 1)) {
    barsInput.value = 4;
  }

  render({ copy: isAutoCopyEnabled() });
}

function setSize(size) {
  selectedSize = size;
  sizeBtns.forEach(b => b.classList.toggle("active", b.dataset.size === size));
  render({ copy: isAutoCopyEnabled() });
}

// ---- Events ----
modeSimpleBtn.addEventListener("click", () => setMode("simple"));
modeAdvancedBtn.addEventListener("click", () => setMode("advanced"));

sizeBtns.forEach(btn => btn.addEventListener("click", () => setSize(btn.dataset.size)));

barsInput.addEventListener("input", () => {
  render({ copy: isAutoCopyEnabled() });
});

tuningSelect.addEventListener("change", () => {
  customTuningWrap.style.display = (tuningSelect.value === "custom") ? "inline-flex" : "none";
  render({ copy: isAutoCopyEnabled() });
});

customTuningInput.addEventListener("input", () => {
  render({ copy: isAutoCopyEnabled() });
});

legendChk.addEventListener("change", () => render({ copy: isAutoCopyEnabled() }));

titleOnChk.addEventListener("change", () => {
  titleInput.disabled = !titleOnChk.checked;
  render({ copy: isAutoCopyEnabled() });
});

titleInput.addEventListener("input", () => render({ copy: isAutoCopyEnabled() }));

// Only attach this listener IF the checkbox exists
if (autoCopyChk) {
  autoCopyChk.addEventListener("change", () => render());
}

copyBtn.addEventListener("click", () => {
  const text = buildTabText();
  copyText(text)
    .then(() => setStatus("Copied ✅"))
    .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
});

// ---- Init ----
customTuningWrap.style.display = "none";
titleInput.disabled = true;
setSize("medium");
setMode("simple");
render();