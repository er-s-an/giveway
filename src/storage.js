// GiveWay storage layer — the only module allowed to touch localStorage.
// Holds { version: 1, baseline, decision } under a versioned key, validates
// everything it reads, and refuses every write while a malformed save is
// sitting under the key — the only escape is the explicit
// "Use sample and replace saved data" action (replaceWithSample).

import {
  sampleBaseline,
  validateBaseline,
  canSave,
} from "./model.js";

export const STORAGE_KEY = "giveway:v1";

const MALFORMED_WARNING =
  "Your saved data could not be read, so the sample week is shown instead. The saved data was left untouched, and nothing will be written over it.";

function defaultStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Strict shape check for a stored decision: a plain object with a string
// candidateName, integer candidateTicks, and a plain-object concession map of
// integer ticks. Anything else is malformed — never partially trusted.
function hasDecisionShape(decision) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return false;
  if (typeof decision.candidateName !== "string") return false;
  if (!Number.isInteger(decision.candidateTicks)) return false;
  const concessions = decision.concessions;
  if (!concessions || typeof concessions !== "object" || Array.isArray(concessions)) return false;
  return Object.values(concessions).every((ticks) => Number.isInteger(ticks));
}

// Full validation of a persisted payload via the model's validators. The
// `decision` field must exist and be either null or a fully valid decision
// (valid candidate, valid flexible-only concessions, exact reconciliation).
export function validatePersisted(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  if (parsed.version !== 1) return false;
  if (!Object.prototype.hasOwnProperty.call(parsed, "baseline")) return false;
  if (!Object.prototype.hasOwnProperty.call(parsed, "decision")) return false;
  if (!validateBaseline(parsed.baseline).ok) return false;
  const decision = parsed.decision;
  if (decision === null) return true;
  if (!hasDecisionShape(decision)) return false;
  return canSave(parsed.baseline, decision);
}

// A storage handle bound to one store (defaults to localStorage; tests pass a
// stub). The writeBlocked guard lives here so no controller path can bypass it.
export function createStorage(store = defaultStore()) {
  let writeBlocked = false;

  function sampleState(extra) {
    return {
      baseline: sampleBaseline(),
      decision: null,
      warning: null,
      ...extra,
    };
  }

  function load() {
    if (!store) return sampleState({ writeBlocked: false, storageDurable: false });
    let raw = null;
    try {
      raw = store.getItem(STORAGE_KEY);
    } catch {
      return sampleState({ writeBlocked: false, storageDurable: false });
    }
    if (raw === null) return sampleState({ writeBlocked: false, storageDurable: true });
    try {
      const parsed = JSON.parse(raw);
      if (!validatePersisted(parsed)) throw new Error("invalid saved state");
      return {
        baseline: parsed.baseline,
        decision: parsed.decision,
        writeBlocked: false,
        warning: null,
        storageDurable: true,
      };
    } catch {
      writeBlocked = true;
      return sampleState({ writeBlocked: true, storageDurable: true, warning: MALFORMED_WARNING });
    }
  }

  // Persists { version, baseline, decision }. Refused while writeBlocked, so a
  // corrupt save can never be silently overwritten. A store failure (private
  // mode, quota) leaves memory state working and reports { ok: false }.
  function save(baseline, decision) {
    if (!store) return { ok: false, reason: "unavailable" };
    if (writeBlocked) return { ok: false, reason: "blocked" };
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, baseline, decision }));
      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  // The one explicit escape from the write-blocked state: overwrite the key
  // with the sample baseline and no decision, then allow writes again.
  function replaceWithSample() {
    const baseline = sampleBaseline();
    if (!store) return { ok: false, reason: "unavailable", baseline };
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, baseline, decision: null }));
      writeBlocked = false;
      return { ok: true, baseline };
    } catch {
      return { ok: false, reason: "unavailable", baseline };
    }
  }

  return { load, save, replaceWithSample, isWriteBlocked: () => writeBlocked };
}
