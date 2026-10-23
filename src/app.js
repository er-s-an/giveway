// GiveWay DOM controller — the only module that touches the document.
// Hours become ticks exactly once on input and hours again exactly once on
// display; everything between is the pure model. All persistence goes through
// the storage module, so the malformed-data write guard cannot be bypassed.

import * as M from "./model.js";
import { createStorage } from "./storage.js";

const storage = createStorage();
const loaded = storage.load();

const state = {
  baseline: loaded.baseline,
  savedDecision: loaded.decision,
  writeBlocked: loaded.writeBlocked,
  storageDurable: loaded.storageDurable,
  editing: false,
  candidateName: "",
  candidateHoursText: "",
  concessionTexts: {}, // flexible block id -> raw input text
  saveAttempted: false,
  compareMode: false, // the optional A/B comparison starts closed
  planB: { candidateName: "", candidateHoursText: "", concessionTexts: {} },
  saveAttemptedB: false,
  compareAnnounce: {
    a: { canSave: null, errors: "" },
    b: { canSave: null, errors: "" },
  },
  baselineDraft: null, // [{ id, name, hoursText, type }] while editing the baseline
  baselineOpen: false, // the custom-baseline disclosure starts collapsed
  baselineErrorSignature: null, // null until the first baseline error render primes it
  announcedCanSave: null, // last announced Save availability; null until first render
  announcedErrorSignature: "", // visible validation errors last announced
};

const els = {
  skipLink: document.getElementById("skip-link"),
  startAction: document.getElementById("start-action"),
  startActionLabel: document.getElementById("start-action-label"),
  storageBanner: document.getElementById("storage-banner"),
  storageWarning: document.getElementById("storage-warning"),
  replaceStorage: document.getElementById("replace-storage"),
  weekHeading: document.getElementById("week-heading"),
  weekNote: document.getElementById("week-note"),
  ribbon: document.getElementById("ribbon"),
  ribbonLegend: document.getElementById("ribbon-legend"),
  blockList: document.getElementById("block-list"),
  weekTotal: document.getElementById("week-total"),
  baselineLockNote: document.getElementById("baseline-lock-note"),
  baselineEditor: document.getElementById("baseline-editor"),
  baselineToggle: document.getElementById("baseline-toggle"),
  baselinePanel: document.getElementById("baseline-panel"),
  baselineRows: document.getElementById("baseline-rows"),
  baselineFreeTime: document.getElementById("baseline-free-time"),
  baselineTotalError: document.getElementById("baseline-total-error"),
  addBlock: document.getElementById("add-block"),
  applyBaseline: document.getElementById("apply-baseline"),
  composerZone: document.getElementById("zone-composer"),
  candidateName: document.getElementById("candidate-name"),
  candidateNameError: document.getElementById("candidate-name-error"),
  candidateHours: document.getElementById("candidate-hours"),
  candidateHoursError: document.getElementById("candidate-hours-error"),
  concessionsZone: document.getElementById("zone-concessions"),
  demandNumber: document.getElementById("demand-number"),
  demandTrack: document.getElementById("demand-track"),
  demandFill: document.getElementById("demand-fill"),
  demandCaption: document.getElementById("demand-caption"),
  readout: document.getElementById("readout"),
  concessionControls: document.getElementById("concession-controls"),
  saveButton: document.getElementById("save-decision"),
  saveHint: document.getElementById("save-hint"),
  compareToggle: document.getElementById("compare-toggle"),
  compareZone: document.getElementById("zone-compare"),
  compareHeading: document.getElementById("compare-heading"),
  exitCompare: document.getElementById("exit-compare"),
  chooseA: document.getElementById("choose-a"),
  chooseB: document.getElementById("choose-b"),
  receiptZone: document.getElementById("zone-receipt"),
  receiptHeading: document.getElementById("receipt-heading"),
  receiptSummary: document.getElementById("receipt-summary"),
  receiptBody: document.getElementById("receipt-body"),
  decisionActions: document.getElementById("decision-actions"),
  editDecision: document.getElementById("edit-decision"),
  undoDecision: document.getElementById("undo-decision"),
  announcer: document.getElementById("announcer"),
};

function announce(message) {
  els.announcer.textContent = "";
  els.announcer.textContent = message;
}

// Every composer value runs through the model's pure gate: a decision can be
// saved only when the candidate is valid, every non-empty concession field
// parses on the 0.5 h grid, and valid concessions reconcile exactly.
function composed() {
  return M.composeDecision(
    state.baseline,
    state.candidateName,
    state.candidateHoursText,
    state.concessionTexts
  );
}

// Shared save path for applying a baseline, saving a decision, choosing a
// compared plan, and undo. Durability follows the write that actually landed.
// A blocked write is the malformed-data guard, not a durability flip — the
// replace action stays the only way out of that state.
function persist(baseline, decision) {
  const result = storage.save(baseline, decision);
  if (result.reason !== "blocked") state.storageDurable = result.ok === true;
  renderStorageBanner();
  return result;
}

function persistCaveat(result) {
  if (result.ok) return "";
  if (result.reason === "blocked") {
    return " It is kept for this session only — your unreadable saved data is still protected; use the replace action above to keep changes across refreshes.";
  }
  return " It is kept for this session only — a refresh may lose this change or restore the previous saved decision.";
}

// --- Zone 1: ribbon and baseline ----------------------------------------------

function weekBlocks() {
  return state.savedDecision
    ? M.deriveAfterWeek(state.baseline, state.savedDecision)
    : M.blocksWithFreeTime(state.baseline);
}

function renderWeek() {
  const blocks = weekBlocks();
  const after = Boolean(state.savedDecision);
  els.weekNote.textContent = after
    ? "The week as it now stands, after your saved decision. The receipt below keeps the clear Before view."
    : "Your baseline week. Named blocks plus the derived Free Time always sum to exactly 168 hours.";

  els.ribbon.replaceChildren();
  els.ribbon.setAttribute(
    "aria-label",
    `Week ribbon: ${blocks.map((b) => `${b.name} ${M.formatHours(b.ticks)}`).join(", ")}. Total 168 h.`
  );
  for (const block of blocks) {
    const segment = document.createElement("div");
    segment.className = `ribbon-segment type-${block.type}`;
    segment.style.flexGrow = String(Math.max(block.ticks, 0));
    segment.title = `${block.name} — ${M.formatHours(block.ticks)} (${block.type})`;
    els.ribbon.appendChild(segment);
  }

  const types = ["fixed", "flexible", "protected"];
  els.ribbonLegend.replaceChildren();
  for (const type of types) {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = `swatch type-${type}`;
    item.append(swatch, document.createTextNode(type));
    els.ribbonLegend.appendChild(item);
  }

  els.blockList.replaceChildren();
  for (const block of blocks) {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.className = "block-name";
    name.textContent = block.name;
    row.appendChild(name);
    if (block.label) {
      const label = document.createElement("span");
      label.className = "block-label";
      label.textContent = block.label;
      row.appendChild(label);
    }
    const hours = document.createElement("span");
    hours.className = "block-hours";
    hours.textContent = M.formatHours(block.ticks);
    const type = document.createElement("span");
    type.className = "block-type";
    type.textContent = block.type;
    row.append(hours, type);
    els.blockList.appendChild(row);
  }

  const total = blocks.reduce((sum, b) => sum + b.ticks, 0);
  els.weekTotal.textContent = `Total: ${M.formatHours(total)}`;

  // The baseline editor is locked while a decision is saved, so the receipt's
  // Before view stays honest; undo releases the lock. The editor sits behind a
  // collapsed disclosure by default — the sample week and the commitment
  // composer are the primary path, building your own baseline is optional.
  els.baselineLockNote.hidden = !after;
  els.baselineEditor.hidden = after;
  if (after) {
    setBaselineOpen(false);
  } else if (state.baselineOpen) {
    if (!state.baselineDraft) openBaselineDraft();
    renderBaselineEditor();
    updateBaselineErrors();
  }
}

// --- Zone 1: build-your-own baseline editor -------------------------------------

// The disclosure toggle. Focus stays on the toggle when it opens or closes
// (standard disclosure behaviour); closing never discards the draft, so a
// reopened editor shows exactly what the user left. A saved decision hides the
// whole editor (see renderWeek), and applying a baseline collapses it again.
function setBaselineOpen(open) {
  state.baselineOpen = open;
  els.baselineToggle.setAttribute("aria-expanded", String(open));
  els.baselinePanel.hidden = !open;
  if (open) {
    if (!state.baselineDraft) openBaselineDraft();
    renderBaselineEditor();
    updateBaselineErrors();
  }
}

function openBaselineDraft() {
  state.baselineDraft = state.baseline.blocks.map((block) => ({
    id: block.id,
    name: block.name,
    hoursText: String(M.ticksToHours(block.ticks)),
    type: block.type,
  }));
}

// Each repeated row needs its own identity in the accessibility tree: the
// visible label stays short ("Name", "Hours", "Kind") while a visually hidden
// prefix names the block, so screen readers hear "Sleep name", "Sleep hours".
// Rows with no name yet are a stable "new block".
function rowContext(row) {
  return row.name.trim() || "new block";
}

function updateRowLabelContext(row) {
  for (const field of ["name", "hours", "type"]) {
    const span = document.getElementById(`baseline-ctx-${field}-${row.id}`);
    if (span) span.textContent = `${rowContext(row)} `;
  }
}

function makeRowLabel(row, field, visibleText) {
  const label = document.createElement("label");
  label.htmlFor = `baseline-${field}-${row.id}`;
  const context = document.createElement("span");
  context.className = "visually-hidden";
  context.id = `baseline-ctx-${field}-${row.id}`;
  context.textContent = `${rowContext(row)} `;
  label.append(context, document.createTextNode(visibleText));
  return label;
}

// Structural render (open, add, remove). Typing only updates errors, so an
// input never loses focus mid-keystroke.
function renderBaselineEditor() {
  els.baselineRows.replaceChildren();
  state.baselineDraft.forEach((row, index) => {
    const wrap = document.createElement("div");
    wrap.className = "baseline-row";

    const nameLabel = makeRowLabel(row, "name", "Name");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.autocomplete = "off";
    nameInput.id = `baseline-name-${row.id}`;
    nameInput.value = row.name;
    nameInput.setAttribute("aria-describedby", `baseline-name-error-${row.id}`);
    nameInput.addEventListener("input", () => {
      row.name = nameInput.value;
      updateRowLabelContext(row);
      updateBaselineErrors();
    });
    const nameError = document.createElement("p");
    nameError.className = "error";
    nameError.id = `baseline-name-error-${row.id}`;
    nameError.hidden = true;

    const hoursLabel = makeRowLabel(row, "hours", "Hours");
    const hoursInput = document.createElement("input");
    hoursInput.type = "number";
    hoursInput.min = "0";
    hoursInput.step = "0.5";
    hoursInput.inputMode = "decimal";
    hoursInput.id = `baseline-hours-${row.id}`;
    hoursInput.value = row.hoursText;
    hoursInput.setAttribute("aria-describedby", `baseline-hours-error-${row.id}`);
    hoursInput.addEventListener("input", () => {
      row.hoursText = hoursInput.value;
      updateBaselineErrors();
    });
    const hoursError = document.createElement("p");
    hoursError.className = "error";
    hoursError.id = `baseline-hours-error-${row.id}`;
    hoursError.hidden = true;

    const typeLabel = makeRowLabel(row, "type", "Kind");
    const typeSelect = document.createElement("select");
    typeSelect.id = `baseline-type-${row.id}`;
    for (const type of M.BLOCK_TYPES) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    }
    typeSelect.value = row.type;
    typeSelect.addEventListener("change", () => {
      row.type = typeSelect.value;
      updateBaselineErrors();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${row.name.trim() || `block ${index + 1}`}`);
    remove.addEventListener("click", () => {
      state.baselineDraft.splice(index, 1);
      renderBaselineEditor();
      updateBaselineErrors();
      // Keep keyboard focus on a real control: the row that slid into this
      // position, or the Add a block button when the removed row was last.
      const rows = els.baselineRows.querySelectorAll(".baseline-row");
      const next = rows[Math.min(index, rows.length - 1)];
      const nextRemove = next ? next.querySelector("button") : null;
      (nextRemove || els.addBlock).focus();
    });

    const nameField = document.createElement("div");
    nameField.className = "field";
    nameField.append(nameLabel, nameInput, nameError);
    const hoursField = document.createElement("div");
    hoursField.className = "field";
    hoursField.append(hoursLabel, hoursInput, hoursError);
    const typeField = document.createElement("div");
    typeField.className = "field";
    typeField.append(typeLabel, typeSelect);

    wrap.append(nameField, hoursField, typeField, remove);
    els.baselineRows.appendChild(wrap);
  });
}

function draftBlocks() {
  return state.baselineDraft.map((row) => {
    const parsed = M.parseHoursText(row.hoursText);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      ticks: parsed.status === "ok" ? parsed.ticks : 0,
      hoursInvalid: parsed.status === "invalid",
    };
  });
}

function updateBaselineErrors() {
  const blocks = draftBlocks();
  const result = M.validateBaseline({ blocks });
  const visibleErrors = [];

  for (const row of state.baselineDraft) {
    const nameError = document.getElementById(`baseline-name-error-${row.id}`);
    const hoursError = document.getElementById(`baseline-hours-error-${row.id}`);
    if (nameError) {
      nameError.textContent = "";
      nameError.hidden = true;
    }
    if (hoursError) {
      hoursError.textContent = "";
      hoursError.hidden = true;
    }
  }

  state.baselineDraft.forEach((row, index) => {
    const nameInput = document.getElementById(`baseline-name-${row.id}`);
    const hoursInput = document.getElementById(`baseline-hours-${row.id}`);
    if (nameInput) nameInput.removeAttribute("aria-invalid");
    if (hoursInput) hoursInput.removeAttribute("aria-invalid");
    if (!blocks[index].hoursInvalid) return;
    const hoursError = document.getElementById(`baseline-hours-error-${row.id}`);
    if (hoursError) {
      hoursError.textContent = "Hours must be non-negative and in 0.5 h increments.";
      hoursError.hidden = false;
      visibleErrors.push({
        key: `baseline-hours-${row.id}`,
        label: `${rowContext(row)} hours`,
        message: hoursError.textContent,
      });
    }
    if (hoursInput) hoursInput.setAttribute("aria-invalid", "true");
  });

  let totalMessage = "";
  for (const error of result.errors) {
    if (error.index === null) {
      totalMessage = error.message;
      continue;
    }
    // Internal ids are generated uniquely by Add a block, so id errors carry no
    // user action — they are never surfaced (users cannot edit an id).
    if (error.field === "id") continue;
    const row = state.baselineDraft[error.index];
    if (!row) continue;
    const target =
      document.getElementById(`baseline-${error.field}-error-${row.id}`) ||
      document.getElementById(`baseline-name-error-${row.id}`);
    if (!target || !target.hidden) continue; // an invalid-text error already sits here
    target.textContent = error.message;
    target.hidden = false;
    visibleErrors.push({
      key: `baseline-${error.field}-${row.id}`,
      label: `${rowContext(row)} ${error.field === "type" ? "kind" : error.field}`,
      message: error.message,
    });
    const input = document.getElementById(`baseline-${error.field}-${row.id}`);
    if (input) input.setAttribute("aria-invalid", "true");
  }
  els.baselineTotalError.textContent = totalMessage;
  els.baselineTotalError.hidden = !totalMessage;
  if (totalMessage) {
    visibleErrors.push({ key: "baseline-total", label: "Baseline total", message: totalMessage });
  }

  const sum = blocks.reduce((total, block) => total + block.ticks, 0);
  if (sum <= M.WEEK_TICKS) {
    els.baselineFreeTime.textContent = `Free Time: ${M.formatHours(
      M.WEEK_TICKS - sum
    )} — derived as whatever is left of the 168 h week, never typed.`;
  } else {
    els.baselineFreeTime.textContent = "Free Time: none — the blocks already exceed the 168 h week.";
  }

  const anyInvalidHours = blocks.some((block) => block.hoursInvalid);
  els.applyBaseline.disabled = !result.ok || anyInvalidHours;

  // Announce baseline errors on transitions only — never per keystroke. The
  // first render after opening primes the signature silently so a restored
  // draft doesn't read out every error at once.
  const signature = visibleErrors.map((e) => `${e.key}|${e.message}`).join(";");
  if (state.baselineErrorSignature === null) {
    state.baselineErrorSignature = signature;
  } else if (signature !== state.baselineErrorSignature) {
    const previous = new Set(
      state.baselineErrorSignature ? state.baselineErrorSignature.split(";") : []
    );
    const added = visibleErrors.filter((e) => !previous.has(`${e.key}|${e.message}`));
    state.baselineErrorSignature = signature;
    if (added.length > 0) {
      announce(added.map((e) => `${e.label}: ${e.message}`).join(" "));
    } else if (visibleErrors.length === 0) {
      announce("The baseline entries are valid now.");
    }
  }
}

function onApplyBaseline() {
  const blocks = draftBlocks();
  const candidate = {
    blocks: blocks.map(({ id, name, type, ticks }) => ({ id, name: name.trim(), type, ticks })),
  };
  if (!M.validateBaseline(candidate).ok || blocks.some((b) => b.hoursInvalid)) {
    updateBaselineErrors();
    return;
  }
  if (state.compareMode) exitCompare({ silent: true }); // a new baseline resets every draft
  const result = persist(candidate, null);
  state.baseline = candidate;
  state.savedDecision = null;
  state.editing = false;
  state.saveAttempted = false;
  state.candidateName = "";
  state.candidateHoursText = "";
  state.concessionTexts = {};
  state.announcedCanSave = null;
  state.announcedErrorSignature = "";
  els.candidateName.value = "";
  els.candidateHours.value = "";
  els.concessionControls.replaceChildren();
  els.receiptZone.hidden = true;
  openBaselineDraft();
  // Applying collapses the editor again and returns focus to its toggle, so
  // the user lands back on the primary path with the announcement explaining
  // what changed.
  setBaselineOpen(false);
  state.baselineErrorSignature = null; // the next open primes silently
  renderWeek();
  updateDecisionSurfaces();
  announce(`Baseline replaced. Your week now sums to 168 h with ${M.formatHours(M.deriveFreeTime(candidate).ticks)} of Free Time.${persistCaveat(result)}`);
  els.baselineToggle.focus();
}

// --- Zone 3: concession controls, transfer tracks, live readout ---------------

function flexibleBlocks() {
  return M.blocksWithFreeTime(state.baseline).filter((b) => b.type === "flexible");
}

// Structural render only (called when the candidate's hours appear), so typing
// in a concession field never loses focus.
function renderConcessionControls() {
  els.concessionControls.replaceChildren();
  for (const block of flexibleBlocks()) {
    if (!(block.id in state.concessionTexts)) state.concessionTexts[block.id] = "";
    const row = document.createElement("div");
    row.className = "concession-row";

    const label = document.createElement("label");
    label.htmlFor = `concession-${block.id}`;
    label.textContent = `${block.name} — hours to give way `;
    const available = document.createElement("span");
    available.className = "available";
    available.textContent = `(${M.formatHours(block.ticks)} available)`;
    label.appendChild(available);

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.5";
    input.inputMode = "decimal";
    input.id = `concession-${block.id}`;
    input.dataset.blockId = block.id;
    input.value = state.concessionTexts[block.id];
    input.setAttribute("aria-describedby", `concession-error-${block.id}`);
    input.addEventListener("input", onConcessionInput);

    const error = document.createElement("p");
    error.className = "error";
    error.id = `concession-error-${block.id}`;
    error.hidden = true;

    // The transfer track: ink pours out of this block toward the commitment.
    // Pure transform animation, interruptible by the next keystroke.
    const transfer = document.createElement("div");
    transfer.className = "transfer";
    const track = document.createElement("div");
    track.className = "transfer-track";
    track.setAttribute("aria-hidden", "true");
    const given = document.createElement("div");
    given.className = "transfer-given";
    given.id = `transfer-given-${block.id}`;
    track.appendChild(given);
    const text = document.createElement("p");
    text.className = "transfer-text";
    text.id = `transfer-text-${block.id}`;
    transfer.append(track, text);

    row.append(label, input, error, transfer);
    els.concessionControls.appendChild(row);
  }
}

function onConcessionInput(event) {
  const id = event.target.dataset.blockId;
  state.concessionTexts[id] = event.target.value;
  updateDecisionSurfaces();
}

// Updates each concession row's inline error and its transfer track. Returns
// the visible errors as { key, label, message } for the live announcer.
function updateConcessionErrors() {
  const visible = [];
  const byId = new Map(M.blocksWithFreeTime(state.baseline).map((b) => [b.id, b]));
  for (const block of flexibleBlocks()) {
    const error = document.getElementById(`concession-error-${block.id}`);
    const input = document.getElementById(`concession-${block.id}`);
    const trackGiven = document.getElementById(`transfer-given-${block.id}`);
    const trackText = document.getElementById(`transfer-text-${block.id}`);
    if (!error) continue;
    const source = byId.get(block.id);
    const parsed = M.parseHoursText(state.concessionTexts[block.id] || "");
    let message = "";
    if (parsed.status === "invalid") {
      message = "Enter a non-negative number in 0.5 h steps.";
    } else if (parsed.status === "ok" && parsed.ticks > source.ticks) {
      message = `"${block.name}" only has ${M.formatHours(source.ticks)} to give.`;
    }
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      visible.push({ key: `concession-${block.id}`, label: block.name, message });
    }
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }

    if (trackGiven && trackText) {
      const givenTicks =
        parsed.status === "ok" ? Math.min(parsed.ticks, source.ticks) : 0;
      const ratio = source.ticks > 0 ? givenTicks / source.ticks : 0;
      trackGiven.style.transform = `scaleX(${ratio})`;
      if (parsed.status === "ok" && parsed.ticks > 0 && parsed.ticks <= source.ticks) {
        trackText.textContent = `${M.formatHours(source.ticks)} → ${M.formatHours(
          source.ticks - parsed.ticks
        )} · gives ${M.formatHours(parsed.ticks)}`;
      } else if (parsed.status === "ok" && parsed.ticks > source.ticks) {
        trackText.textContent = `asks ${M.formatHours(parsed.ticks)} of ${M.formatHours(source.ticks)}`;
      } else {
        trackText.textContent = `${M.formatHours(source.ticks)} available`;
      }
    }
  }
  return visible;
}

// --- Zones 2–4: validation, readout, save gate, receipt -------------------------

// Actionable reasons the full save gate can fail even when the parsed
// concessions already sum to the candidate's hours (an over-capacity source,
// a blank or duplicate commitment name, invalid candidate hours).
function decisionBlockers(result) {
  const messages = [];
  const candidateErrors = M.validateCandidate(state.baseline, {
    name: result.decision.candidateName,
    ticks: result.decision.candidateTicks,
  }).errors;
  for (const error of candidateErrors) messages.push(error.message);
  for (const error of M.validateConcessions(state.baseline, result.decision).errors) {
    messages.push(error.message);
  }
  return messages;
}

// Shared readout wording for the single composer and each compared plan, so
// the same state always reads the same way. The reconciled line says "save" in
// the ordinary composer and "choose this plan" inside the comparison.
function readoutContent(result, blockers, doneWord) {
  const invalid = result.invalidIds.length > 0;
  const remaining = result.remainingTicks;
  if (invalid) {
    return "One concession entry isn't a valid 0.5 h amount — fix the highlighted field before this can be saved.";
  }
  if (remaining > 0) return `Still to allocate: ${M.formatHours(remaining)}`;
  if (remaining < 0) return `${M.formatHours(-remaining)} over — remove concessions until it reconciles.`;
  if (result.canSave) {
    return `Reconciled — every hour is named. You can ${doneWord === "choose" ? "choose this plan" : "save"}.`;
  }
  return `The hours add up, but this can't be saved yet — ${blockers[0] || "check the highlighted fields."}`;
}

function updateDecisionSurfaces() {
  const result = composed();
  const hasCandidate = result.decision.candidateTicks > 0;

  // While the comparison is open the single-plan zones are hidden — the plan
  // cards hold the live fields — but the shared state keeps updating.
  els.concessionsZone.hidden = !hasCandidate || state.compareMode;
  if (hasCandidate && !els.concessionControls.childElementCount && !state.compareMode) {
    renderConcessionControls();
  }
  if (!hasCandidate) {
    els.concessionControls.replaceChildren();
    els.readout.textContent = "";
    els.demandNumber.textContent = "";
    els.demandCaption.textContent = "";
    els.demandFill.style.transform = "scaleX(0)";
    els.demandFill.classList.remove("over");
    els.demandTrack.removeAttribute("aria-label");
  }

  // Candidate field errors (live once the field carries content; always after a save attempt).
  const candidate = { name: state.candidateName.trim(), ticks: result.decision.candidateTicks };
  const candidateErrors = M.validateCandidate(state.baseline, candidate).errors;
  const nameError = candidateErrors.find((e) => e.field === "name");
  const hoursError = candidateErrors.find((e) => e.field === "hours");
  const showName = Boolean(state.candidateName.trim()) || state.saveAttempted;
  const showHours = Boolean(state.candidateHoursText.trim()) || state.saveAttempted;
  const nameShown = Boolean(showName && nameError);
  const hoursShown = Boolean(showHours && hoursError);
  els.candidateNameError.textContent = nameShown ? nameError.message : "";
  els.candidateNameError.hidden = !nameShown;
  els.candidateHoursError.textContent = hoursShown ? hoursError.message : "";
  els.candidateHoursError.hidden = !hoursShown;
  if (nameShown) els.candidateName.setAttribute("aria-invalid", "true");
  else els.candidateName.removeAttribute("aria-invalid");
  if (hoursShown) els.candidateHours.setAttribute("aria-invalid", "true");
  else els.candidateHours.removeAttribute("aria-invalid");

  // Every validation error currently visible, for transition announcements.
  const visibleErrors = [];
  if (nameShown) {
    visibleErrors.push({ key: "candidate-name", label: "Commitment name", message: nameError.message });
  }
  if (hoursShown) {
    visibleErrors.push({ key: "candidate-hours", label: "Weekly hours", message: hoursError.message });
  }

  // Live readout. "Reconciled — you can save" is stated only when the complete
  // model gate (valid candidate + valid concessions + exact sum) passes, so the
  // readout and the disabled/enabled Save button can never disagree.
  const blockers = result.canSave ? [] : decisionBlockers(result);
  if (hasCandidate) {
    els.readout.classList.toggle("reconciled", result.canSave);
    els.readout.textContent = readoutContent(result, blockers, "save");
    visibleErrors.push(...updateConcessionErrors());

    // Demand summary: the ask itself, filled as hours are named. The fill is a
    // transform, so a new keystroke interrupts the previous motion cleanly.
    const candidateTicks = result.decision.candidateTicks;
    const allocated = M.concessionSum(result.decision.concessions);
    const over = allocated > candidateTicks;
    els.demandNumber.textContent = `${M.formatHours(candidateTicks)} to make room for`;
    els.demandFill.style.transform = `scaleX(${Math.min(allocated / candidateTicks, 1)})`;
    els.demandFill.classList.toggle("over", over);
    els.demandTrack.setAttribute(
      "aria-label",
      `${M.formatHours(Math.min(allocated, candidateTicks))} of ${M.formatHours(candidateTicks)} named so far`
    );
    if (over) {
      els.demandCaption.textContent = `${M.formatHours(allocated)} named — ${M.formatHours(allocated - candidateTicks)} more than the commitment needs.`;
    } else if (allocated === candidateTicks) {
      els.demandCaption.textContent = `All ${M.formatHours(candidateTicks)} named.`;
    } else {
      els.demandCaption.textContent = `${M.formatHours(allocated)} of ${M.formatHours(candidateTicks)} named so far.`;
    }
  }

  // Save gate from the pure model, including the raw-field gate. The hint names
  // the actual blocker, so a disabled Save always carries an actionable reason.
  els.saveButton.disabled = !result.canSave;
  els.saveHint.textContent = result.canSave
    ? ""
    : result.invalidIds.length > 0
      ? "Save stays blocked until every concession entry is a valid 0.5 h amount."
      : hasCandidate && result.remainingTicks !== 0
        ? "Save stays blocked until named concessions total the commitment's hours exactly."
        : blockers.length > 0
          ? `Save stays blocked: ${blockers[0]}`
          : "Save stays blocked until the commitment has a valid, unique name and positive weekly hours.";

  // Live announcements, on transitions only — never per keystroke. A newly
  // appearing validation error is announced with its field and message (the
  // duplicate-name case must be heard even while the readout still counts the
  // missing hours); Save availability changes are announced as before.
  const messages = [];
  const signature = visibleErrors.map((e) => `${e.key}|${e.message}`).join(";");
  const previous = new Set(
    state.announcedErrorSignature ? state.announcedErrorSignature.split(";") : []
  );
  const added = visibleErrors.filter((e) => !previous.has(`${e.key}|${e.message}`));
  const hadErrors = previous.size > 0;
  state.announcedErrorSignature = signature;

  let canSaveMessage = "";
  if (state.announcedCanSave === null) {
    state.announcedCanSave = result.canSave;
  } else if (result.canSave !== state.announcedCanSave) {
    state.announcedCanSave = result.canSave;
    canSaveMessage = result.canSave
      ? "Every hour is named and valid — you can save this decision."
      : "Save is no longer available — the current entries no longer pass the full check.";
  }

  if (added.length > 0) {
    messages.push(added.map((e) => `${e.label}: ${e.message}`).join(" "));
  } else if (hadErrors && visibleErrors.length === 0 && !canSaveMessage) {
    messages.push("The highlighted entries are valid now.");
  }
  if (canSaveMessage) messages.push(canSaveMessage);
  if (messages.length > 0) announce(messages.join(" "));
}

// --- Receipt --------------------------------------------------------------------

function englishList(items) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function renderReceipt() {
  const receipt = M.deriveReceipt(state.baseline, state.savedDecision);
  els.receiptBody.replaceChildren();

  // The one-sentence conclusion first, then the full account underneath.
  const gives = receipt.tradeoffs.map(
    (t) => `${M.formatHours(t.concededTicks)} of ${t.name}`
  );
  els.receiptSummary.textContent = `To say yes to “${receipt.candidateName}” (${M.formatHours(
    receipt.candidateTicks
  )}), you gave ${englishList(gives)}.`;

  const changedIds = new Set(receipt.tradeoffs.map((t) => t.id));

  const makeList = (blocks, showLabel) => {
    const list = document.createElement("ul");
    list.className = "receipt-list";
    for (const block of blocks) {
      const row = document.createElement("li");
      const changed = changedIds.has(block.id) || block.id === M.CANDIDATE_ID;
      row.className = changed ? "changed" : "unchanged";
      const name = document.createElement("span");
      name.className = "block-name";
      name.textContent = block.name;
      row.appendChild(name);
      if (showLabel && block.label) {
        const label = document.createElement("span");
        label.className = "block-label";
        label.textContent = `${block.label}, ${block.type}`;
        row.appendChild(label);
      }
      const hours = document.createElement("span");
      hours.className = "block-hours";
      hours.textContent = M.formatHours(block.ticks);
      row.appendChild(hours);
      list.appendChild(row);
    }
    return list;
  };

  const makePanel = (headingText, listNode, totalText) => {
    const panel = document.createElement("div");
    panel.className = "receipt-panel";
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    panel.append(heading, listNode);
    if (totalText) {
      const total = document.createElement("p");
      total.className = "receipt-total";
      total.textContent = totalText;
      panel.appendChild(total);
    }
    return panel;
  };

  const makeArrow = () => {
    const arrow = document.createElement("span");
    arrow.className = "receipt-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    return arrow;
  };

  const tradeList = document.createElement("ul");
  tradeList.className = "receipt-list";
  const candidateRow = document.createElement("li");
  candidateRow.className = "changed";
  const candidateName = document.createElement("span");
  candidateName.className = "block-name";
  candidateName.textContent = receipt.candidateName;
  const candidateLabel = document.createElement("span");
  candidateLabel.className = "block-label";
  candidateLabel.textContent = "new commitment";
  const candidateHours = document.createElement("span");
  candidateHours.className = "block-hours";
  candidateHours.textContent = `+${M.formatHours(receipt.candidateTicks)}`;
  candidateRow.append(candidateName, candidateLabel, candidateHours);
  tradeList.appendChild(candidateRow);
  for (const tradeoff of receipt.tradeoffs) {
    const row = document.createElement("li");
    row.className = "changed";
    const name = document.createElement("span");
    name.className = "block-name";
    name.textContent = tradeoff.name;
    const hours = document.createElement("span");
    hours.className = "block-hours";
    hours.textContent = `${M.formatHours(tradeoff.beforeTicks)} → ${M.formatHours(tradeoff.afterTicks)}`;
    row.append(name, hours);
    tradeList.appendChild(row);
  }

  const columns = document.createElement("div");
  columns.className = "receipt-columns";
  columns.append(
    makePanel("Before", makeList(receipt.before, false), `Total: ${M.formatHours(receipt.beforeTotal)}`),
    makeArrow(),
    makePanel("Tradeoffs", tradeList, `Moves: ${M.formatHours(receipt.candidateTicks)}`),
    makeArrow(),
    makePanel("After", makeList(receipt.after, true), `Total: ${M.formatHours(receipt.afterTotal)}`)
  );
  els.receiptBody.appendChild(columns);

  // Entrance motion: opacity + translate only, replayed on each render.
  els.receiptBody.classList.remove("receipt-in");
  void els.receiptBody.offsetWidth;
  els.receiptBody.classList.add("receipt-in");

  els.receiptZone.hidden = false;
}

// --- Compare two ways to say yes (optional A/B mode) ---------------------------

// Plan A IS the ordinary composer draft — the same state fields the single
// form edits — so entering or leaving the comparison never loses it. Plan B is
// an independent in-memory draft that is never persisted unless chosen.
function planDraft(which) {
  return which === "a" ? state : state.planB;
}

function planEl(which, part) {
  return document.getElementById(`plan-${which}-${part}`);
}

function planLabel(which) {
  return which === "a" ? "Plan A" : "Plan B";
}

function planComposed(which) {
  const draft = planDraft(which);
  // Both plans go through the one pure gate against the same untouched
  // baseline — see M.comparePlans for the model-level guarantee.
  return M.composeDecision(
    state.baseline,
    draft.candidateName,
    draft.candidateHoursText,
    draft.concessionTexts
  );
}

// Structural render of one plan card's concession rows (per-plan ids, so both
// cards can hold the same flexible blocks side by side).
function renderPlanConcessions(which) {
  const host = planEl(which, "concessions");
  const draft = planDraft(which);
  host.replaceChildren();
  for (const block of flexibleBlocks()) {
    if (!(block.id in draft.concessionTexts)) draft.concessionTexts[block.id] = "";
    const row = document.createElement("div");
    row.className = "concession-row";

    const label = document.createElement("label");
    label.htmlFor = `plan-${which}-concession-${block.id}`;
    label.textContent = `${block.name} — hours to give way `;
    const available = document.createElement("span");
    available.className = "available";
    available.textContent = `(${M.formatHours(block.ticks)} available)`;
    label.appendChild(available);

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.5";
    input.inputMode = "decimal";
    input.id = `plan-${which}-concession-${block.id}`;
    input.dataset.blockId = block.id;
    input.value = draft.concessionTexts[block.id];
    input.setAttribute("aria-describedby", `plan-${which}-concession-error-${block.id}`);
    input.addEventListener("input", () => {
      draft.concessionTexts[block.id] = input.value;
      updatePlan(which);
    });

    const error = document.createElement("p");
    error.className = "error";
    error.id = `plan-${which}-concession-error-${block.id}`;
    error.hidden = true;

    const transfer = document.createElement("div");
    transfer.className = "transfer";
    const track = document.createElement("div");
    track.className = "transfer-track";
    track.setAttribute("aria-hidden", "true");
    const given = document.createElement("div");
    given.className = "transfer-given";
    given.id = `plan-${which}-transfer-given-${block.id}`;
    track.appendChild(given);
    const text = document.createElement("p");
    text.className = "transfer-text";
    text.id = `plan-${which}-transfer-text-${block.id}`;
    transfer.append(track, text);

    row.append(label, input, error, transfer);
    host.appendChild(row);
  }
}

// What the plan trades, in plain account lines: the commitment, every named
// source Before → After, Free Time always, what stays put, and both totals.
// Rendered only from concessions that pass validation, so an off-grid or
// over-capacity entry can never paint a misleading After.
function renderPlanSummary(which, result) {
  const host = planEl(which, "summary");
  host.replaceChildren();
  const decision = result.decision;
  if (decision.candidateTicks <= 0) return;
  const concessionsClean =
    result.invalidIds.length === 0 && M.validateConcessions(state.baseline, decision).ok;
  if (!concessionsClean) {
    const note = document.createElement("p");
    note.className = "summary-note";
    note.textContent = "Fix the highlighted fields above to see exactly what this plan trades.";
    host.appendChild(note);
    return;
  }
  const receipt = M.deriveReceipt(state.baseline, decision);
  const list = document.createElement("ul");

  const candidateRow = document.createElement("li");
  candidateRow.className = "changed";
  const candidateName = document.createElement("span");
  candidateName.className = "block-name";
  candidateName.textContent = decision.candidateName || "(unnamed commitment)";
  const candidateHours = document.createElement("span");
  candidateHours.className = "block-hours";
  candidateHours.textContent = `+${M.formatHours(decision.candidateTicks)} new`;
  candidateRow.append(candidateName, candidateHours);
  list.appendChild(candidateRow);

  const concededIds = new Set(receipt.tradeoffs.map((t) => t.id));
  for (const tradeoff of receipt.tradeoffs) {
    if (tradeoff.id === M.FREE_TIME_ID) continue; // Free Time gets its own line below
    const row = document.createElement("li");
    row.className = "changed";
    const name = document.createElement("span");
    name.className = "block-name";
    name.textContent = tradeoff.name;
    const hours = document.createElement("span");
    hours.className = "block-hours";
    hours.textContent = `${M.formatHours(tradeoff.beforeTicks)} → ${M.formatHours(tradeoff.afterTicks)}`;
    row.append(name, hours);
    list.appendChild(row);
  }

  const freeBefore = receipt.before.find((b) => b.id === M.FREE_TIME_ID);
  const freeTrade = receipt.tradeoffs.find((t) => t.id === M.FREE_TIME_ID);
  const freeRow = document.createElement("li");
  freeRow.className = freeTrade ? "changed" : "unchanged";
  const freeName = document.createElement("span");
  freeName.className = "block-name";
  freeName.textContent = M.FREE_TIME_NAME;
  const freeHours = document.createElement("span");
  freeHours.className = "block-hours";
  freeHours.textContent = freeTrade
    ? `${M.formatHours(freeTrade.beforeTicks)} → ${M.formatHours(freeTrade.afterTicks)}`
    : `stays ${M.formatHours(freeBefore.ticks)}`;
  freeRow.append(freeName, freeHours);
  list.appendChild(freeRow);

  const untouched = receipt.before.filter((b) => b.id !== M.FREE_TIME_ID && !concededIds.has(b.id));
  if (untouched.length > 0) {
    const row = document.createElement("li");
    row.className = "unchanged";
    const name = document.createElement("span");
    name.className = "block-name";
    name.textContent = untouched.map((b) => b.name).join(", ");
    const hours = document.createElement("span");
    hours.className = "block-hours";
    hours.textContent = `${M.formatHours(untouched.reduce((sum, b) => sum + b.ticks, 0))} stays put`;
    row.append(name, hours);
    list.appendChild(row);
  }

  host.appendChild(list);
  const total = document.createElement("p");
  total.className = "summary-total";
  total.textContent = `Before ${M.formatHours(receipt.beforeTotal)} · After ${M.formatHours(receipt.afterTotal)}`;
  host.appendChild(total);
  if (result.remainingTicks !== 0) {
    const note = document.createElement("p");
    note.className = "summary-note";
    note.textContent =
      "Not balanced yet — the named hours must total the commitment's hours exactly before this plan can be chosen.";
    host.appendChild(note);
  }
}

// Per-keystroke update of one plan card: candidate errors, concession errors,
// transfer tracks, readout, the Choose gate, the tradeoff summary, and
// transition-only live announcements prefixed with the plan's name.
function updatePlan(which) {
  const draft = planDraft(which);
  const result = planComposed(which);
  const hasCandidate = result.decision.candidateTicks > 0;
  const attempted = which === "a" ? state.saveAttempted : state.saveAttemptedB;

  const candidate = { name: draft.candidateName.trim(), ticks: result.decision.candidateTicks };
  const candidateErrors = M.validateCandidate(state.baseline, candidate).errors;
  const nameError = candidateErrors.find((e) => e.field === "name");
  const hoursError = candidateErrors.find((e) => e.field === "hours");
  const nameShown = Boolean((draft.candidateName.trim() || attempted) && nameError);
  const hoursShown = Boolean((draft.candidateHoursText.trim() || attempted) && hoursError);
  const nameInput = planEl(which, "name");
  const hoursInput = planEl(which, "hours");
  const nameErrorEl = planEl(which, "name-error");
  const hoursErrorEl = planEl(which, "hours-error");
  nameErrorEl.textContent = nameShown ? nameError.message : "";
  nameErrorEl.hidden = !nameShown;
  hoursErrorEl.textContent = hoursShown ? hoursError.message : "";
  hoursErrorEl.hidden = !hoursShown;
  if (nameShown) nameInput.setAttribute("aria-invalid", "true");
  else nameInput.removeAttribute("aria-invalid");
  if (hoursShown) hoursInput.setAttribute("aria-invalid", "true");
  else hoursInput.removeAttribute("aria-invalid");

  const visibleErrors = [];
  if (nameShown) {
    visibleErrors.push({
      key: `${which}-name`,
      label: `${planLabel(which)} commitment name`,
      message: nameError.message,
    });
  }
  if (hoursShown) {
    visibleErrors.push({
      key: `${which}-hours`,
      label: `${planLabel(which)} weekly hours`,
      message: hoursError.message,
    });
  }

  const blockers = result.canSave ? [] : decisionBlockers(result);
  const readout = planEl(which, "readout");
  readout.classList.toggle("reconciled", result.canSave);
  readout.textContent = hasCandidate ? readoutContent(result, blockers, "choose") : "";

  const byId = new Map(M.blocksWithFreeTime(state.baseline).map((b) => [b.id, b]));
  for (const block of flexibleBlocks()) {
    const error = document.getElementById(`plan-${which}-concession-error-${block.id}`);
    const input = document.getElementById(`plan-${which}-concession-${block.id}`);
    const trackGiven = document.getElementById(`plan-${which}-transfer-given-${block.id}`);
    const trackText = document.getElementById(`plan-${which}-transfer-text-${block.id}`);
    if (!error) continue;
    const source = byId.get(block.id);
    const parsed = M.parseHoursText(draft.concessionTexts[block.id] || "");
    let message = "";
    if (parsed.status === "invalid") {
      message = "Enter a non-negative number in 0.5 h steps.";
    } else if (parsed.status === "ok" && parsed.ticks > source.ticks) {
      message = `"${block.name}" only has ${M.formatHours(source.ticks)} to give.`;
    }
    error.textContent = message;
    error.hidden = !message;
    if (message) {
      visibleErrors.push({
        key: `${which}-concession-${block.id}`,
        label: `${planLabel(which)} ${block.name}`,
        message,
      });
    }
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    if (trackGiven && trackText) {
      const givenTicks = parsed.status === "ok" ? Math.min(parsed.ticks, source.ticks) : 0;
      const ratio = source.ticks > 0 ? givenTicks / source.ticks : 0;
      trackGiven.style.transform = `scaleX(${ratio})`;
      if (parsed.status === "ok" && parsed.ticks > 0 && parsed.ticks <= source.ticks) {
        trackText.textContent = `${M.formatHours(source.ticks)} → ${M.formatHours(
          source.ticks - parsed.ticks
        )} · gives ${M.formatHours(parsed.ticks)}`;
      } else if (parsed.status === "ok" && parsed.ticks > source.ticks) {
        trackText.textContent = `asks ${M.formatHours(parsed.ticks)} of ${M.formatHours(source.ticks)}`;
      } else {
        trackText.textContent = `${M.formatHours(source.ticks)} available`;
      }
    }
  }

  // The Choose gate is the same complete model gate as Save — a plan that is
  // invalid, off-grid, over-capacity, or mis-named stays unchooseable with the
  // reason next to its button.
  const choose = which === "a" ? els.chooseA : els.chooseB;
  choose.disabled = !result.canSave;
  planEl(which, "hint").textContent = result.canSave
    ? ""
    : result.invalidIds.length > 0
      ? "This plan can't be chosen until every concession entry is a valid 0.5 h amount."
      : hasCandidate && result.remainingTicks !== 0
        ? "This plan can't be chosen until named concessions total the commitment's hours exactly."
        : blockers.length > 0
          ? `This plan can't be chosen yet: ${blockers[0]}`
          : "This plan can't be chosen until the commitment has a valid, unique name and positive weekly hours.";

  renderPlanSummary(which, result);

  // Live announcements on transitions only, always prefixed with the plan name.
  const slot = state.compareAnnounce[which];
  const messages = [];
  const signature = visibleErrors.map((e) => `${e.key}|${e.message}`).join(";");
  const previous = new Set(slot.errors ? slot.errors.split(";") : []);
  const added = visibleErrors.filter((e) => !previous.has(`${e.key}|${e.message}`));
  const hadErrors = previous.size > 0;
  slot.errors = signature;
  let canSaveMessage = "";
  if (slot.canSave === null) {
    slot.canSave = result.canSave;
  } else if (result.canSave !== slot.canSave) {
    slot.canSave = result.canSave;
    canSaveMessage = result.canSave
      ? `${planLabel(which)} is fully named and valid — you can choose it.`
      : `${planLabel(which)} can no longer be chosen — its entries no longer pass the full check.`;
  }
  if (added.length > 0) {
    messages.push(added.map((e) => `${e.label}: ${e.message}`).join(" "));
  } else if (hadErrors && visibleErrors.length === 0 && !canSaveMessage) {
    messages.push(`${planLabel(which)}'s highlighted entries are valid now.`);
  }
  if (canSaveMessage) messages.push(canSaveMessage);
  if (messages.length > 0) announce(messages.join(" "));
}

function enterCompare() {
  state.compareMode = true;
  // Plan B begins as an editable copy of the current draft — independent from
  // the first keystroke after this point.
  state.planB = {
    candidateName: state.candidateName,
    candidateHoursText: state.candidateHoursText,
    concessionTexts: { ...state.concessionTexts },
  };
  state.saveAttemptedB = false;
  state.compareAnnounce = {
    a: { canSave: null, errors: "" },
    b: { canSave: null, errors: "" },
  };
  planEl("a", "name").value = state.candidateName;
  planEl("a", "hours").value = state.candidateHoursText;
  planEl("b", "name").value = state.planB.candidateName;
  planEl("b", "hours").value = state.planB.candidateHoursText;
  renderPlanConcessions("a");
  renderPlanConcessions("b");
  els.compareZone.hidden = false;
  els.compareZone.classList.remove("compare-in");
  void els.compareZone.offsetWidth;
  els.compareZone.classList.add("compare-in");
  refreshDecisionChrome();
  updateDecisionSurfaces(); // hides the single-plan zones while comparing
  updatePlan("a");
  updatePlan("b");
  announce(
    "Comparing two ways to say yes. Both plans start from the same week — only the plan you choose is saved. Plan B begins as a copy of your draft."
  );
  els.compareHeading.focus();
}

function exitCompare({ silent = false } = {}) {
  if (!state.compareMode) return;
  state.compareMode = false;
  state.planB = { candidateName: "", candidateHoursText: "", concessionTexts: {} };
  els.compareZone.hidden = true;
  // Hand Plan A's latest entries back to the ordinary composer — the draft the
  // user started with is never lost by comparing or by leaving.
  els.candidateName.value = state.candidateName;
  els.candidateHours.value = state.candidateHoursText;
  els.concessionControls.replaceChildren();
  refreshDecisionChrome();
  updateDecisionSurfaces();
  if (!silent) {
    announce("Back to one plan. Your draft is exactly where you left it; Plan B was only ever a draft.");
    els.compareToggle.focus();
  }
}

function onChoose(which) {
  if (which === "a") state.saveAttempted = true;
  else state.saveAttemptedB = true;
  const result = planComposed(which);
  if (!result.canSave) {
    updatePlan(which);
    const firstInvalid = result.invalidIds[0];
    if (firstInvalid) {
      const input = document.getElementById(`plan-${which}-concession-${firstInvalid}`);
      if (input) input.focus();
    } else if (!planEl(which, "name-error").hidden) {
      planEl(which, "name").focus();
    } else if (!planEl(which, "hours-error").hidden) {
      planEl(which, "hours").focus();
    }
    const reason = result.invalidIds.length
      ? "one concession entry isn't a valid 0.5 h amount."
      : result.remainingTicks !== 0
        ? "the named concessions do not reconcile exactly with the commitment's hours."
        : decisionBlockers(result)[0] || "the commitment is not complete yet.";
    announce(`${planLabel(which)} can't be chosen yet: ${reason}`);
    return;
  }
  finalizeSave(result.decision, `${planLabel(which)} chosen.`);
}

// --- Save, edit, undo ------------------------------------------------------------

function clearComposer() {
  state.candidateName = "";
  state.candidateHoursText = "";
  state.concessionTexts = {};
  state.saveAttempted = false;
  state.announcedCanSave = null; // a cleared composer is not a "save lost" transition
  state.announcedErrorSignature = "";
  els.candidateName.value = "";
  els.candidateHours.value = "";
  els.concessionControls.replaceChildren();
}

// The single persistence path for every way a decision is saved — the ordinary
// Save button or choosing a compared plan. Only the decision passed in is
// persisted; anything else stays an in-memory draft.
function finalizeSave(decision, lead = "Decision saved.") {
  const persisted = persist(state.baseline, decision);
  state.savedDecision = decision;
  state.editing = false;
  if (state.compareMode) exitCompare({ silent: true });
  clearComposer();
  renderWeek();
  renderReceipt();
  refreshDecisionChrome();
  updateDecisionSurfaces();
  announce(
    `${lead} ${decision.candidateName}, ${M.formatHours(
      decision.candidateTicks
    )}, is now in the week. The receipt is below.${persistCaveat(persisted)}`
  );
  els.receiptHeading.focus();
}

function refreshDecisionChrome() {
  const saved = Boolean(state.savedDecision);
  els.decisionActions.hidden = !saved;
  els.composerZone.hidden = (saved && !state.editing) || state.compareMode;
  // The skip link and the first-screen start action must always land on
  // visible main content: the composer while composing, the comparison while
  // comparing, the receipt once a decision is saved (including after reload).
  const skipToReceipt = saved && !state.editing;
  let target = "composer-heading";
  let skipText = "Skip to the commitment composer";
  let startText = "Start a new commitment";
  if (skipToReceipt) {
    target = "receipt-heading";
    skipText = "Skip to your saved decision receipt";
    startText = "See your saved decision receipt";
  } else if (state.compareMode) {
    target = "compare-heading";
    skipText = "Skip to the plan comparison";
    startText = "See the plan comparison";
  }
  els.skipLink.setAttribute("href", `#${target}`);
  els.skipLink.textContent = skipText;
  els.startAction.setAttribute("href", `#${target}`);
  els.startActionLabel.textContent = startText;
}

function onSave() {
  state.saveAttempted = true;
  const result = composed();
  if (!result.canSave) {
    updateDecisionSurfaces();
    const firstInvalid = result.invalidIds[0];
    if (firstInvalid) {
      const input = document.getElementById(`concession-${firstInvalid}`);
      if (input) input.focus();
    } else if (!els.candidateNameError.hidden) {
      els.candidateName.focus();
    } else if (!els.candidateHoursError.hidden) {
      els.candidateHours.focus();
    }
    // Announce the actual blocker, matching the readout and the Save hint.
    const reason = result.invalidIds.length
      ? "one concession entry isn't a valid 0.5 h amount."
      : result.remainingTicks !== 0
        ? "the named concessions do not reconcile exactly with the commitment's hours."
        : decisionBlockers(result)[0] || "the commitment is not complete yet.";
    announce(`Save is blocked: ${reason}`);
    return;
  }
  finalizeSave(result.decision);
}

function onEdit() {
  if (!state.savedDecision) return;
  state.editing = true;
  state.saveAttempted = false;
  state.candidateName = state.savedDecision.candidateName;
  state.candidateHoursText = String(M.ticksToHours(state.savedDecision.candidateTicks));
  state.concessionTexts = {};
  for (const [id, ticks] of Object.entries(state.savedDecision.concessions)) {
    state.concessionTexts[id] = String(M.ticksToHours(ticks));
  }
  els.candidateName.value = state.candidateName;
  els.candidateHours.value = state.candidateHoursText;
  els.concessionControls.replaceChildren(); // rebuilt with the saved values
  state.announcedCanSave = null; // restoring a reconciled composer is not a new transition
  state.announcedErrorSignature = "";
  refreshDecisionChrome();
  updateDecisionSurfaces();
  renderStorageBanner();
  els.candidateName.focus();
  const editCaveat = state.storageDurable
    ? ""
    : " This session's version was not saved — a refresh may lose it or restore the previous saved decision.";
  announce(
    `Editing the saved decision. Everything recomputes from the original baseline — nothing stacks.${editCaveat}`
  );
}

function onUndo() {
  if (!state.savedDecision) return;
  const persisted = persist(state.baseline, null);
  state.savedDecision = null;
  state.editing = false;
  clearComposer();
  els.receiptZone.hidden = true;
  renderWeek();
  refreshDecisionChrome();
  updateDecisionSurfaces();
  announce(`Decision undone. The week is back to the plain baseline.${persistCaveat(persisted)}`);
  els.candidateName.focus();
}

// --- Malformed-storage recovery ----------------------------------------------------

function renderStorageBanner() {
  if (state.writeBlocked) {
    els.storageWarning.textContent = loaded.warning;
    els.replaceStorage.hidden = false;
    els.storageBanner.hidden = false;
  } else if (state.storageDurable === false) {
    els.storageWarning.textContent =
      "This browser is not saving changes. They stay available in this session, but a refresh may lose them or restore the previous saved decision.";
    els.replaceStorage.hidden = true;
    els.storageBanner.hidden = false;
  } else {
    els.storageBanner.hidden = true;
  }
}

function onReplaceStorage() {
  const result = storage.replaceWithSample();
  if (!result.ok) {
    if (result.reason !== "blocked") state.storageDurable = false;
    renderStorageBanner();
    announce("Storage is not available in this browser, so the saved data cannot be replaced.");
    return;
  }
  state.baseline = result.baseline;
  state.savedDecision = null;
  state.writeBlocked = false;
  state.storageDurable = true;
  state.editing = false;
  if (state.compareMode) exitCompare({ silent: true });
  clearComposer();
  els.receiptZone.hidden = true;
  openBaselineDraft();
  setBaselineOpen(false);
  state.baselineErrorSignature = null;
  renderStorageBanner();
  renderWeek();
  refreshDecisionChrome();
  updateDecisionSurfaces();
  announce("The unreadable saved data was replaced with the sample week. Changes will be saved from now on.");
  els.weekHeading.focus();
}

// --- Events ---------------------------------------------------------------------

// The skip link's href already tracks which main zone is visible (see
// refreshDecisionChrome); this handler guarantees focus lands on the target
// heading even in browsers whose default anchor jump does not move focus.
els.skipLink.addEventListener("click", () => {
  const id = els.skipLink.getAttribute("href").slice(1);
  const target = document.getElementById(id);
  if (target && !target.closest("[hidden]")) target.focus();
});

// The start action is a plain anchor jump (instant, no smooth scrolling, so
// reduced-motion and no-animation use are respected by construction); this
// handler adds what the default jump does not guarantee — real keyboard focus
// on the visible target heading.
els.startAction.addEventListener("click", () => {
  const id = els.startAction.getAttribute("href").slice(1);
  const target = document.getElementById(id);
  if (target && !target.closest("[hidden]")) target.focus();
});

els.baselineToggle.addEventListener("click", () => {
  setBaselineOpen(!state.baselineOpen);
  announce(
    state.baselineOpen
      ? "Custom baseline editor opened. Your entries stay until you apply them or replace the saved data."
      : "Custom baseline editor closed. Any entries you made are kept in the editor."
  );
});

els.candidateName.addEventListener("input", () => {
  state.candidateName = els.candidateName.value;
  updateDecisionSurfaces();
});

els.candidateHours.addEventListener("input", () => {
  state.candidateHoursText = els.candidateHours.value;
  updateDecisionSurfaces();
});

els.saveButton.addEventListener("click", onSave);
els.editDecision.addEventListener("click", onEdit);
els.undoDecision.addEventListener("click", onUndo);
els.replaceStorage.addEventListener("click", onReplaceStorage);

els.compareToggle.addEventListener("click", enterCompare);
els.exitCompare.addEventListener("click", () => exitCompare());
els.chooseA.addEventListener("click", () => onChoose("a"));
els.chooseB.addEventListener("click", () => onChoose("b"));
planEl("a", "name").addEventListener("input", () => {
  state.candidateName = planEl("a", "name").value;
  updatePlan("a");
});
planEl("a", "hours").addEventListener("input", () => {
  state.candidateHoursText = planEl("a", "hours").value;
  updatePlan("a");
});
planEl("b", "name").addEventListener("input", () => {
  state.planB.candidateName = planEl("b", "name").value;
  updatePlan("b");
});
planEl("b", "hours").addEventListener("input", () => {
  state.planB.candidateHoursText = planEl("b", "hours").value;
  updatePlan("b");
});

els.addBlock.addEventListener("click", () => {
  // Ids come from what the draft already holds — including ids persisted in an
  // earlier session — so a reload can never re-issue an existing custom-N id.
  const id = M.nextBlockId(state.baselineDraft.map((row) => row.id));
  state.baselineDraft.push({ id, name: "", hoursText: "", type: "flexible" });
  renderBaselineEditor();
  updateBaselineErrors();
  document.getElementById(`baseline-name-${id}`).focus();
});

els.applyBaseline.addEventListener("click", onApplyBaseline);

// --- First render -----------------------------------------------------------------

renderStorageBanner();
renderWeek();
if (state.baselineDraft) updateBaselineErrors();
refreshDecisionChrome();
updateDecisionSurfaces();
if (state.savedDecision) {
  renderReceipt();
  announce("Your saved decision and its receipt were restored. The ribbon shows the week as it now stands.");
}
