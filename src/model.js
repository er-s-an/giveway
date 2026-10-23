// GiveWay pure time model — no DOM, no storage. Data in, data out.
// All times are integer half-hour ticks internally (week = 336 ticks).

export const WEEK_TICKS = 336;
export const TICKS_PER_HOUR = 2;
export const FREE_TIME_ID = "free-time";
export const FREE_TIME_NAME = "Free Time";
export const CANDIDATE_ID = "candidate";
export const BLOCK_TYPES = ["fixed", "flexible", "protected"];

// --- UI-boundary conversion -------------------------------------------------

// Hours -> ticks. Rejects non-numbers, non-finite values, and anything off the
// 0.5 h grid. Never rounds: 1.3 h is rejected, not approximated.
export function hoursToTicks(hours) {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return null;
  const ticks = hours * TICKS_PER_HOUR;
  if (!Number.isInteger(ticks)) return null;
  return ticks;
}

export function ticksToHours(ticks) {
  return ticks / TICKS_PER_HOUR;
}

export function formatHours(ticks) {
  const hours = ticksToHours(ticks);
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${text} h`;
}

// Raw input text -> ticks at the UI boundary. Empty is a distinct status from
// invalid so callers can tell "no entry" apart from "an entry we must reject".
export function parseHoursText(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed === "") return { status: "empty", ticks: 0 };
  const ticks = hoursToTicks(Number(trimmed));
  if (ticks === null || ticks < 0) return { status: "invalid", ticks: 0 };
  return { status: "ok", ticks };
}

// --- Baseline ---------------------------------------------------------------

export function sampleBaseline() {
  return {
    blocks: [
      { id: "sleep", name: "Sleep", ticks: 112, type: "protected" },
      { id: "classes", name: "Classes", ticks: 48, type: "fixed" },
      { id: "study", name: "Study", ticks: 56, type: "flexible" },
      { id: "side-project", name: "Side project", ticks: 20, type: "flexible" },
      { id: "meals-care", name: "Meals and care", ticks: 42, type: "fixed" },
      { id: "travel", name: "Travel", ticks: 14, type: "fixed" },
      { id: "rest", name: "Rest", ticks: 28, type: "protected" },
      { id: "admin", name: "Admin", ticks: 8, type: "fixed" },
    ],
  };
}

// Returns { ok, errors:[{ index, field, message }] } with structured per-field
// errors for the UI to place.
export function validateBaseline(baseline) {
  const errors = [];
  if (!baseline || !Array.isArray(baseline.blocks)) {
    return {
      ok: false,
      errors: [{ index: null, field: "blocks", message: "A baseline must be a list of blocks." }],
    };
  }
  const seenIds = new Set();
  const seenNames = new Set();
  let sum = 0;
  baseline.blocks.forEach((block, index) => {
    if (!block || typeof block !== "object") {
      errors.push({ index, field: "block", message: "Each block must be an object." });
      return;
    }
    const id = typeof block.id === "string" ? block.id.trim() : "";
    if (!id) {
      errors.push({ index, field: "id", message: "ID must be non-empty." });
    } else if (id === FREE_TIME_ID || id === CANDIDATE_ID) {
      errors.push({ index, field: "id", message: `The ID "${id}" is reserved.` });
    } else if (seenIds.has(id)) {
      errors.push({ index, field: "id", message: `Duplicate ID "${id}".` });
    } else {
      seenIds.add(id);
    }
    const name = typeof block.name === "string" ? block.name.trim() : "";
    if (!name) {
      errors.push({ index, field: "name", message: "Name must be non-empty." });
    } else {
      const key = name.toLowerCase();
      if (key === FREE_TIME_NAME.toLowerCase()) {
        errors.push({ index, field: "name", message: `"${FREE_TIME_NAME}" is reserved for the derived block.` });
      } else if (seenNames.has(key)) {
        errors.push({ index, field: "name", message: `Duplicate name "${name}".` });
      } else {
        seenNames.add(key);
      }
    }
    if (!Number.isInteger(block.ticks) || block.ticks < 0) {
      errors.push({ index, field: "hours", message: "Hours must be non-negative and in 0.5 h increments." });
    } else {
      sum += block.ticks;
    }
    if (!BLOCK_TYPES.includes(block.type)) {
      errors.push({ index, field: "type", message: "Type must be fixed, flexible, or protected." });
    }
  });
  if (sum > WEEK_TICKS) {
    errors.push({ index: null, field: "total", message: "Blocks exceed 168 h in total." });
  }
  return { ok: errors.length === 0, errors };
}

export function baselineSum(baseline) {
  return baseline.blocks.reduce((sum, block) => sum + block.ticks, 0);
}

// Free Time is derived, never stored.
export function deriveFreeTime(baseline) {
  return {
    id: FREE_TIME_ID,
    name: FREE_TIME_NAME,
    ticks: WEEK_TICKS - baselineSum(baseline),
    type: "flexible",
  };
}

export function blocksWithFreeTime(baseline) {
  return [...baseline.blocks, deriveFreeTime(baseline)];
}

// Allocates the lowest unused custom-N id. Persisted baselines can already
// contain custom-N ids from earlier sessions, so the next id must be derived
// from what exists — never from a per-session counter that resets on reload.
export function nextBlockId(existingIds) {
  const used = new Set(existingIds);
  let n = 1;
  while (used.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

// --- Candidate and concessions ----------------------------------------------

// candidate: { name, ticks }. Ticks must be positive: zero is not a decision.
export function validateCandidate(baseline, candidate) {
  const errors = [];
  const name = candidate && typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!name) {
    errors.push({ field: "name", message: "Give the commitment a name." });
  } else {
    const key = name.toLowerCase();
    const clash = blocksWithFreeTime(baseline).some(
      (block) => block.name.trim().toLowerCase() === key
    );
    if (clash) {
      errors.push({
        field: "name",
        message: "The name must differ from every existing block, including Free Time.",
      });
    }
  }
  const ticks = candidate ? candidate.ticks : NaN;
  if (!Number.isInteger(ticks) || ticks <= 0) {
    errors.push({ field: "hours", message: "Hours must be positive and in 0.5 h increments." });
  }
  return { ok: errors.length === 0, errors };
}

// decision: { candidateName, candidateTicks, concessions: { blockId: ticks } }.
// Sources must be flexible blocks (Free Time included); protected/fixed are
// rejected even when they arrive by id via stale DOM or loaded storage.
export function validateConcessions(baseline, decision) {
  const errors = [];
  const concessions = decision && decision.concessions ? decision.concessions : {};
  const byId = new Map(blocksWithFreeTime(baseline).map((block) => [block.id, block]));
  for (const [id, ticks] of Object.entries(concessions)) {
    const block = byId.get(id);
    if (!block) {
      errors.push({ blockId: id, message: `Unknown block "${id}".` });
      continue;
    }
    if (block.type !== "flexible") {
      errors.push({ blockId: id, message: `"${block.name}" is ${block.type} and cannot give way.` });
      continue;
    }
    if (!Number.isInteger(ticks) || ticks < 0) {
      errors.push({ blockId: id, message: "A concession must be non-negative and in 0.5 h increments." });
      continue;
    }
    if (ticks > block.ticks) {
      errors.push({
        blockId: id,
        message: `Cannot concede more than "${block.name}" currently has (${formatHours(block.ticks)}).`,
      });
    }
  }
  return { ok: errors.length === 0, errors };
}

export function concessionSum(concessions) {
  return Object.values(concessions || {}).reduce(
    (sum, ticks) => sum + (Number.isInteger(ticks) && ticks > 0 ? ticks : 0),
    0
  );
}

// Positive while hours are still to allocate, negative on overage.
export function remainingTicks(decision) {
  const candidateTicks = decision && Number.isInteger(decision.candidateTicks) ? decision.candidateTicks : 0;
  return candidateTicks - concessionSum(decision ? decision.concessions : {});
}

// The save gate: exact reconciliation only — insufficient and excess both block.
export function canSave(baseline, decision) {
  if (!decision) return false;
  if (!validateCandidate(baseline, { name: decision.candidateName, ticks: decision.candidateTicks }).ok) {
    return false;
  }
  if (!validateConcessions(baseline, decision).ok) return false;
  return (
    Number.isInteger(decision.candidateTicks) &&
    decision.candidateTicks > 0 &&
    concessionSum(decision.concessions) === decision.candidateTicks
  );
}

// The full composer gate over raw UI text. Every non-empty concession field is
// parsed; an invalid entry is NEVER silently dropped from the gate — it lands
// in invalidIds and blocks save even when the valid entries already reconcile
// (the exact P1 case: candidate 12 h, Free Time 4 h + Side project 8 h entered,
// plus an off-grid "Study 1.3 h" must keep Save disabled).
export function composeDecision(baseline, candidateName, candidateHoursText, concessionTexts) {
  const hours = parseHoursText(candidateHoursText);
  const concessions = {};
  const invalidIds = [];
  for (const [id, text] of Object.entries(concessionTexts || {})) {
    const parsed = parseHoursText(text);
    if (parsed.status === "empty") continue;
    if (parsed.status === "invalid") {
      invalidIds.push(id);
      continue;
    }
    if (parsed.ticks > 0) concessions[id] = parsed.ticks;
  }
  const decision = {
    candidateName: String(candidateName ?? "").trim(),
    candidateTicks: hours.status === "ok" ? hours.ticks : 0,
    concessions,
  };
  const candidateValid =
    hours.status === "ok" &&
    validateCandidate(baseline, { name: decision.candidateName, ticks: decision.candidateTicks }).ok;
  return {
    decision,
    invalidIds,
    hoursStatus: hours.status,
    remainingTicks: remainingTicks(decision),
    canSave: candidateValid && invalidIds.length === 0 && canSave(baseline, decision),
  };
}

// --- A/B comparison: one gate, one untouched baseline -------------------------

// Runs two independent drafts through the same composeDecision gate against
// the SAME baseline object. Neither plan receives a derived week: every
// capacity and duplicate-name check reads the untouched baseline blocks, so
// Plan A can never stack on, or silently borrow hours from, Plan B.
// planA/planB: { candidateName, candidateHoursText, concessionTexts }.
export function comparePlans(baseline, planA, planB) {
  return {
    baseline,
    planA: composeDecision(
      baseline,
      planA ? planA.candidateName : "",
      planA ? planA.candidateHoursText : "",
      planA ? planA.concessionTexts : {}
    ),
    planB: composeDecision(
      baseline,
      planB ? planB.candidateName : "",
      planB ? planB.candidateHoursText : "",
      planB ? planB.concessionTexts : {}
    ),
  };
}

// --- After week and receipt (derived fresh from the untouched baseline) ------

export function deriveAfterWeek(baseline, decision) {
  const concessions = decision ? decision.concessions || {} : {};
  const after = baseline.blocks.map((block) => ({
    ...block,
    ticks: block.ticks - (concessions[block.id] || 0),
  }));
  if (decision) {
    after.push({
      id: CANDIDATE_ID,
      name: decision.candidateName,
      ticks: decision.candidateTicks,
      type: "fixed",
      label: "new commitment",
    });
  }
  const sum = after.reduce((total, block) => total + block.ticks, 0);
  after.push({
    id: FREE_TIME_ID,
    name: FREE_TIME_NAME,
    ticks: WEEK_TICKS - sum,
    type: "flexible",
  });
  return after;
}

export function deriveReceipt(baseline, decision) {
  const before = blocksWithFreeTime(baseline);
  const byId = new Map(before.map((block) => [block.id, block]));
  const tradeoffs = Object.entries(decision.concessions || {})
    .filter(([, ticks]) => Number.isInteger(ticks) && ticks > 0)
    .map(([id, ticks]) => {
      const block = byId.get(id);
      return {
        id,
        name: block.name,
        beforeTicks: block.ticks,
        afterTicks: block.ticks - ticks,
        concededTicks: ticks,
      };
    });
  const after = deriveAfterWeek(baseline, decision);
  const total = (blocks) => blocks.reduce((sum, block) => sum + block.ticks, 0);
  return {
    candidateName: decision.candidateName,
    candidateTicks: decision.candidateTicks,
    before,
    tradeoffs,
    after,
    beforeTotal: total(before),
    afterTotal: total(after),
  };
}
