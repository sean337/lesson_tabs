// LessonTabs — grid-based tab builder (vanilla JS)

// ---------- Constants ----------
const TEMPLATE_WIDTH = { short: 40, medium: 80, long: 120 };
const LEGEND_TEXT = "Tech: h=hammer  p=pull  b=bend  /=slide up  \\=slide down";

const PRESET_TUNINGS = {
  standard: ["E","A","D","G","B","e"],        // low -> high
  dropd:    ["D","A","D","G","B","e"],
  halfdown: ["Eb","Ab","Db","Gb","Bb","eb"],
};

// ✅ Preview spacing controls (this is the “older spacing” vibe)
const LABEL_PAD = 2;        // pad string labels so Eb etc don't shift pipes
const MIN_COL_W = 3;        // minimum width per beat
const SEP_DASHES = 2;       // 👈 breathing room between beats (set to 1,2,3 to taste)

// Display order is high->low in the grid/preview
function toDisplayOrder(lowToHigh) {
  return [lowToHigh[5], lowToHigh[4], lowToHigh[3], lowToHigh[2], lowToHigh[1], lowToHigh[0]];
}

// ---------- DOM ----------
const gridEl = document.getElementById("grid");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");

const beatCountEl = document.getElementById("beatCount");
const minusBeatBtn = document.getElementById("minusBeat");
const plusBeatBtn = document.getElementById("plusBeat");

const atIndexInput = document.getElementById("atIndex");
const insertBtn = document.getElementById("insertBtn");
const deleteBtn = document.getElementById("deleteBtn");

const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const copyOutputBtn = document.getElementById("copyOutputBtn");

const tuningSelect = document.getElementById("tuningSelect");
const customTuningWrap = document.getElementById("customTuningWrap");
const customTuningInput = document.getElementById("customTuningInput");
const tuningWarn = document.getElementById("tuningWarn");

const notesInput = document.getElementById("notesInput");
const legendChk = document.getElementById("legendChk");
const legendLine = document.getElementById("legendLine");
const showColLabelsChk = document.getElementById("showColLabels");

const copyTemplateShort = document.getElementById("copyTemplateShort");
const copyTemplateMedium = document.getElementById("copyTemplateMedium");
const copyTemplateLong = document.getElementById("copyTemplateLong");

// ---------- State ----------
const STRINGS = 6; // always 6-string guitar
let beats = 8;

// gridData[row][col] where row=0 is top string in display order (high e)
let gridData = Array.from({ length: STRINGS }, () => Array.from({ length: beats }, () => ""));

// optional per-column labels (shift with insert/delete)
let colLabels = Array.from({ length: beats }, () => "");

// history for undo (simple)
let history = [];

// ---------- Helpers ----------
function pushHistory() {
  history.push({
    beats,
    gridData: gridData.map(r => r.slice()),
    colLabels: colLabels.slice(),
    tuningMode: tuningSelect.value,
    customTuning: customTuningInput.value,
    notes: notesInput.value,
    legend: legendChk.checked,
    showLabels: showColLabelsChk.checked,
  });
  if (history.length > 50) history.shift();
}

function setStatus(msg, ms = 1400) {
  statusEl.textContent = msg || "";
  if (msg) setTimeout(() => (statusEl.textContent = ""), ms);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeCustomTuning(str) {
  const parts = str.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 6) return null;
  return parts;
}

function getDisplayStringLabels() {
  const mode = tuningSelect.value;

  if (mode === "custom") {
    const parsed = normalizeCustomTuning(customTuningInput.value);
    if (!parsed) return null;
    return toDisplayOrder(parsed);
  }

  const base = PRESET_TUNINGS[mode] || PRESET_TUNINGS.standard;
  return toDisplayOrder(base);
}

function ensureLengths() {
  for (let r = 0; r < STRINGS; r++) {
    while (gridData[r].length < beats) gridData[r].push("");
    if (gridData[r].length > beats) gridData[r] = gridData[r].slice(0, beats);
  }
  while (colLabels.length < beats) colLabels.push("");
  if (colLabels.length > beats) colLabels = colLabels.slice(0, beats);
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function buildBlankTemplate(width) {
  const line = "|" + "-".repeat(width) + "|";
  return `e${line}
B${line}
G${line}
D${line}
A${line}
E${line}`;
}

// ✅ Compute per-column width based on longest token, with a minimum width.
function computeColWidths() {
  const widths = Array.from({ length: beats }, () => MIN_COL_W);

  for (let c = 0; c < beats; c++) {
    let w = MIN_COL_W;
    for (let r = 0; r < STRINGS; r++) {
      const tok = (gridData[r][c] || "").trim();
      if (tok.length > w) w = tok.length;
    }
    // labels should also influence width a bit (so CMAJ7 doesn't jam)
    if (showColLabelsChk.checked) {
      const lab = (colLabels[c] || "").trim();
      if (lab.length > w) w = lab.length;
    }
    widths[c] = w;
  }
  return widths;
}

function renderPreview() {
  const notes = (notesInput.value || "").trim();
  const headerLine = notes.length ? notes : "Example notes";

  const showLegend = legendChk.checked;
  const showLabels = !!showColLabelsChk.checked;

  const labels = getDisplayStringLabels();
  tuningWarn.textContent = "";

  let displayLabels;
  if (tuningSelect.value === "custom") {
    if (!labels) tuningWarn.textContent = "Custom tuning must be 6 notes like: E A D G B e";
    displayLabels = labels || ["e","B","G","D","A","E"];
  } else {
    displayLabels = labels || ["e","B","G","D","A","E"];
  }

  const colW = computeColWidths();
  const sep = "-".repeat(SEP_DASHES);

  function buildLineForRow(r) {
    const lab = (displayLabels[r] || "").padEnd(LABEL_PAD, " ");
    let s = lab + "|";

    for (let c = 0; c < beats; c++) {
      const tok = (gridData[r][c] || "").trim();
      const w = colW[c];

      if (tok.length === 0) {
        s += "-".repeat(w) + sep;
      } else {
        const pad = Math.max(0, w - tok.length);
        s += tok + "-".repeat(pad) + sep;
      }
    }

    s += "|";
    return s;
  }

  // ✅ Optional column labels line in preview (aligned to beats)
  let labelsBlock = "";
  if (showLabels) {
    const anyLabel = colLabels.some(l => (l || "").trim().length > 0);
    if (anyLabel) {
      const prefix = " ".repeat(LABEL_PAD) + "|";
      let labelLine = prefix;

      for (let c = 0; c < beats; c++) {
        const w = colW[c];
        const txt = (colLabels[c] || "").trim();
        labelLine += txt.padEnd(w, " ") + " ".repeat(SEP_DASHES);
      }

      labelsBlock = labelLine.replace(/\s+$/, "") + "\n\n";
    }
  }

  const lines = Array.from({ length: STRINGS }, (_, r) => buildLineForRow(r)).join("\n");
  const output = headerLine + "\n\n" + labelsBlock + lines + (showLegend ? ("\n\n" + LEGEND_TEXT) : "");

  previewEl.value = output;

  legendLine.style.display = showLegend ? "block" : "none";
  legendLine.textContent = LEGEND_TEXT;
}

function buildGrid() {
  ensureLengths();
  gridEl.style.setProperty("--beats", String(beats));
  gridEl.innerHTML = "";

  // Row 1: column numbers
  const corner1 = document.createElement("div");
  corner1.className = "gridCorner";
  gridEl.appendChild(corner1);

  for (let c = 0; c < beats; c++) {
    const n = document.createElement("div");
    n.className = "colNum";
    n.textContent = String(c + 1);
    gridEl.appendChild(n);
  }

  // Row 2: optional column labels
  const corner2 = document.createElement("div");
  corner2.className = "gridCorner";
  gridEl.appendChild(corner2);

  const showLabels = !!showColLabelsChk.checked;
  for (let c = 0; c < beats; c++) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "form-control form-control-sm colLabelInput";
    inp.value = colLabels[c] || "";
    inp.placeholder = showLabels ? "Label" : "";
    inp.disabled = !showLabels;

    inp.addEventListener("input", () => {
      colLabels[c] = inp.value;
      renderPreview(); // ✅ labels DO affect preview now
    });

    gridEl.appendChild(inp);
  }

  const labels = getDisplayStringLabels() || ["e","B","G","D","A","E"];

  for (let r = 0; r < STRINGS; r++) {
    const lab = document.createElement("div");
    lab.className = "stringLabel";
    lab.textContent = labels[r];
    gridEl.appendChild(lab);

    for (let c = 0; c < beats; c++) {
      const cell = document.createElement("input");
      cell.type = "text";
      cell.inputMode = "text";
      cell.autocomplete = "off";
      cell.spellcheck = false;

      cell.className = "form-control form-control-sm cell";
      cell.value = gridData[r][c] || "";

      cell.dataset.r = String(r);
      cell.dataset.c = String(c);

      cell.addEventListener("input", () => {
        gridData[r][c] = cell.value;
        renderPreview();
      });

      cell.addEventListener("keydown", (e) => {
        const rr = parseInt(cell.dataset.r, 10);
        const cc = parseInt(cell.dataset.c, 10);

        if (e.key === "Enter") {
          e.preventDefault();
          focusCell(rr + 1, cc);
        }
        if (e.key === "ArrowRight") focusCell(rr, cc + 1);
        if (e.key === "ArrowLeft") focusCell(rr, cc - 1);
        if (e.key === "ArrowDown") focusCell(rr + 1, cc);
        if (e.key === "ArrowUp") focusCell(rr - 1, cc);
      });

      gridEl.appendChild(cell);
    }
  }

  beatCountEl.textContent = String(beats);
  atIndexInput.value = String(clamp(parseInt(atIndexInput.value || "1", 10), 1, beats));
}

function focusCell(r, c) {
  if (r < 0 || r >= STRINGS) return;
  if (c < 0 || c >= beats) return;
  const el = gridEl.querySelector(`input.cell[data-r="${r}"][data-c="${c}"]`);
  if (el) el.focus();
}

// ---------- Mutations ----------
function insertBeatAt(pos1Based) {
  pushHistory();

  const idx = clamp(pos1Based - 1, 0, beats);
  for (let r = 0; r < STRINGS; r++) gridData[r].splice(idx, 0, "");
  colLabels.splice(idx, 0, "");
  beats += 1;

  buildGrid();
  renderPreview();
  focusCell(0, idx);
}

function deleteBeatAt(pos1Based) {
  if (beats <= 1) return;
  pushHistory();

  const idx = clamp(pos1Based - 1, 0, beats - 1);
  for (let r = 0; r < STRINGS; r++) gridData[r].splice(idx, 1);
  colLabels.splice(idx, 1);
  beats -= 1;

  buildGrid();
  renderPreview();
  focusCell(0, clamp(idx, 0, beats - 1));
}

function addBeat() {
  pushHistory();
  beats += 1;
  for (let r = 0; r < STRINGS; r++) gridData[r].push("");
  colLabels.push("");
  buildGrid();
  renderPreview();
}

function removeBeat() {
  if (beats <= 1) return;
  pushHistory();
  beats -= 1;
  for (let r = 0; r < STRINGS; r++) gridData[r].pop();
  colLabels.pop();
  buildGrid();
  renderPreview();
}

function clearAll() {
  pushHistory();
  gridData = Array.from({ length: STRINGS }, () => Array.from({ length: beats }, () => ""));
  colLabels = Array.from({ length: beats }, () => "");
  notesInput.value = "";
  legendChk.checked = false;
  showColLabelsChk.checked = false;
  buildGrid();
  renderPreview();
  setStatus("Cleared");
}

function undo() {
  const prev = history.pop();
  if (!prev) return;

  beats = prev.beats;
  gridData = prev.gridData.map(r => r.slice());
  colLabels = prev.colLabels.slice();

  tuningSelect.value = prev.tuningMode;
  customTuningInput.value = prev.customTuning;
  notesInput.value = prev.notes;
  legendChk.checked = prev.legend;
  showColLabelsChk.checked = prev.showLabels;

  customTuningWrap.style.display = tuningSelect.value === "custom" ? "block" : "none";

  buildGrid();
  renderPreview();
  setStatus("Undone");
}

// ---------- Events ----------
minusBeatBtn.addEventListener("click", removeBeat);
plusBeatBtn.addEventListener("click", addBeat);

insertBtn.addEventListener("click", () => {
  const pos = parseInt(atIndexInput.value || "1", 10);
  insertBeatAt(clamp(pos, 1, beats + 1));
});

deleteBtn.addEventListener("click", () => {
  const pos = parseInt(atIndexInput.value || "1", 10);
  deleteBeatAt(clamp(pos, 1, beats));
});

undoBtn.addEventListener("click", undo);
clearBtn.addEventListener("click", clearAll);

copyOutputBtn.addEventListener("click", () => {
  copyText(previewEl.value)
    .then(() => setStatus("Copied ✅"))
    .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
});

copyTemplateShort.addEventListener("click", () => {
  copyText(buildBlankTemplate(TEMPLATE_WIDTH.short))
    .then(() => setStatus("Short template copied ✅"))
    .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
});
copyTemplateMedium.addEventListener("click", () => {
  copyText(buildBlankTemplate(TEMPLATE_WIDTH.medium))
    .then(() => setStatus("Medium template copied ✅"))
    .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
});
copyTemplateLong.addEventListener("click", () => {
  copyText(buildBlankTemplate(TEMPLATE_WIDTH.long))
    .then(() => setStatus("Long template copied ✅"))
    .catch(() => setStatus("Copy blocked — use GitHub Pages/localhost."));
});

notesInput.addEventListener("input", renderPreview);
legendChk.addEventListener("change", renderPreview);

showColLabelsChk.addEventListener("change", () => {
  buildGrid();
  renderPreview();
});

tuningSelect.addEventListener("change", () => {
  const isCustom = tuningSelect.value === "custom";
  customTuningWrap.style.display = isCustom ? "block" : "none";
  buildGrid();
  renderPreview();
});

customTuningInput.addEventListener("input", () => {
  if (tuningSelect.value === "custom") {
    buildGrid();
    renderPreview();
  }
});

// ---------- Init ----------
function init() {
  beats = 8;
  gridData = Array.from({ length: STRINGS }, () => Array.from({ length: beats }, () => ""));
  colLabels = Array.from({ length: beats }, () => "");
  notesInput.value = "";
  legendChk.checked = false;
  showColLabelsChk.checked = false;

  customTuningWrap.style.display = "none";
  beatCountEl.textContent = String(beats);

  buildGrid();
  renderPreview();
}

init();
