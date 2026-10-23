// Pure-model tests for GiveWay. Zero dependencies.
// Runs under Node (`node tests/model.test.js`) and in the browser
// (open /tests/tests.html on the local server) against the real shipped module.

import * as M from "../src/model.js";
import { createStorage, STORAGE_KEY, validatePersisted } from "../src/storage.js";

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function check(condition, message) {
  if (!condition) throw new Error(message || "check failed");
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function block(id, name, ticks, type) {
  return { id, name, ticks, type };
}

const sample = M.sampleBaseline();
const referenceDecision = {
  candidateName: "Weekend hackathon",
  candidateTicks: 24,
  concessions: { "free-time": 8, "side-project": 16 },
};

// --- Slice 1: tick conversion, baseline validation, Free Time derivation ----

test("hoursToTicks converts exact half-hour hours", () => {
  eq(M.hoursToTicks(12), 24, "12 h");
  eq(M.hoursToTicks(0.5), 1, "0.5 h");
  eq(M.hoursToTicks(0), 0, "0 h");
  eq(M.ticksToHours(24), 12, "24 ticks");
});

test("hoursToTicks rejects off-grid, negative-grid, NaN, non-finite, and strings — never rounds", () => {
  eq(M.hoursToTicks(1.3), null, "1.3 h off-grid");
  eq(M.hoursToTicks(-1.3), null, "-1.3 h off-grid");
  eq(M.hoursToTicks(NaN), null, "NaN");
  eq(M.hoursToTicks(Infinity), null, "Infinity");
  eq(M.hoursToTicks(-Infinity), null, "-Infinity");
  eq(M.hoursToTicks("12"), null, "string input");
  eq(M.hoursToTicks(undefined), null, "undefined");
});

test("sample baseline is valid and its 8 blocks sum to 328 ticks", () => {
  eq(M.validateBaseline(sample).ok, true, "sample valid");
  eq(sample.blocks.length, 8, "block count");
  eq(M.baselineSum(sample), 328, "sample sum");
});

test("derived Free Time is 8 ticks (4 h), flexible, with the reserved id", () => {
  const freeTime = M.deriveFreeTime(sample);
  eq(freeTime.id, "free-time", "id");
  eq(freeTime.name, "Free Time", "name");
  eq(freeTime.ticks, 8, "ticks");
  eq(freeTime.type, "flexible", "type");
});

test("sample blocks plus derived Free Time sum to exactly 336 ticks (168 h)", () => {
  const all = M.blocksWithFreeTime(sample);
  eq(all.length, 9, "nine named blocks");
  eq(all.reduce((sum, b) => sum + b.ticks, 0), M.WEEK_TICKS, "total");
});

test("baseline validation rejects duplicate and empty names", () => {
  const dup = { blocks: [block("a", "Study", 10, "fixed"), block("b", "study", 10, "fixed")] };
  eq(M.validateBaseline(dup).ok, false, "duplicate names (case-insensitive)");
  const empty = { blocks: [block("a", "   ", 10, "fixed")] };
  eq(M.validateBaseline(empty).ok, false, "empty name");
});

test("baseline validation rejects the reserved Free Time name", () => {
  const reserved = { blocks: [block("a", "Free Time", 10, "flexible")] };
  eq(M.validateBaseline(reserved).ok, false, "reserved name");
  const reservedCase = { blocks: [block("a", " free time ", 10, "flexible")] };
  eq(M.validateBaseline(reservedCase).ok, false, "reserved name, trimmed and lowercased");
});

test("baseline validation rejects duplicate, empty, and reserved IDs", () => {
  const dup = { blocks: [block("a", "One", 10, "fixed"), block("a", "Two", 10, "fixed")] };
  eq(M.validateBaseline(dup).ok, false, "duplicate id");
  const empty = { blocks: [block("", "One", 10, "fixed")] };
  eq(M.validateBaseline(empty).ok, false, "empty id");
  const reserved = { blocks: [block("free-time", "One", 10, "flexible")] };
  eq(M.validateBaseline(reserved).ok, false, "reserved id");
});

test("baseline validation rejects negative, NaN, and off-grid hours", () => {
  eq(M.validateBaseline({ blocks: [block("a", "One", -2, "fixed")] }).ok, false, "negative");
  eq(M.validateBaseline({ blocks: [block("a", "One", NaN, "fixed")] }).ok, false, "NaN");
  eq(M.validateBaseline({ blocks: [block("a", "One", 2.6, "fixed")] }).ok, false, "off-grid");
  eq(M.validateBaseline({ blocks: [block("a", "One", Infinity, "fixed")] }).ok, false, "Infinity");
});

test("baseline validation rejects unknown types and sums over 168 h", () => {
  eq(M.validateBaseline({ blocks: [block("a", "One", 10, "squishy")] }).ok, false, "bad type");
  const over = { blocks: [block("a", "One", 200, "fixed"), block("b", "Two", 200, "fixed")] };
  const result = M.validateBaseline(over);
  eq(result.ok, false, "over 168 h");
  check(result.errors.some((e) => e.field === "total"), "over-sum error identifies the total");
});

test("baseline validation accepts a zero-hour block", () => {
  eq(M.validateBaseline({ blocks: [block("a", "One", 0, "fixed")] }).ok, true, "zero-hour block");
});

// --- Slice 2: candidate, concessions, save gate, receipt ---------------------

test("candidate validation rejects 0, negative, NaN, and off-grid ticks", () => {
  const v = (ticks) => M.validateCandidate(sample, { name: "Weekend hackathon", ticks }).ok;
  eq(v(0), false, "zero is not a decision");
  eq(v(-4), false, "negative");
  eq(v(NaN), false, "NaN");
  eq(v(2.6), false, "off-grid ticks");
  eq(v(Infinity), false, "Infinity");
  eq(v(24), true, "12 h candidate accepted");
});

test("candidate validation rejects empty and duplicate names, including Free Time", () => {
  eq(M.validateCandidate(sample, { name: "  ", ticks: 24 }).ok, false, "empty name");
  eq(M.validateCandidate(sample, { name: "Study", ticks: 24 }).ok, false, "baseline block name");
  eq(M.validateCandidate(sample, { name: "study", ticks: 24 }).ok, false, "case-insensitive");
  eq(M.validateCandidate(sample, { name: "Free Time", ticks: 24 }).ok, false, "Free Time reserved");
});

test("reference scenario reconciles to zero and unblocks save", () => {
  eq(M.validateConcessions(sample, referenceDecision).ok, true, "concessions valid");
  eq(M.remainingTicks(referenceDecision), 0, "readout zero");
  eq(M.canSave(sample, referenceDecision), true, "save allowed");
});

test("insufficient concessions block save with the remainder shown", () => {
  const short = { ...referenceDecision, concessions: { "free-time": 8, "side-project": 14 } };
  eq(M.canSave(sample, short), false, "save blocked");
  eq(M.remainingTicks(short), 2, "1 h still to allocate");
});

test("excess concessions block save with the overage shown", () => {
  const over = { ...referenceDecision, concessions: { "free-time": 8, "side-project": 18 } };
  eq(M.canSave(sample, over), false, "save blocked");
  eq(M.remainingTicks(over), -2, "1 h over");
});

test("no concessions at all blocks save", () => {
  const none = { ...referenceDecision, concessions: {} };
  eq(M.canSave(sample, none), false, "save blocked");
  eq(M.remainingTicks(none), 24, "full 12 h still to allocate");
});

test("protected concessions are rejected by direct model call, even when the sum matches", () => {
  const viaSleep = { ...referenceDecision, concessions: { sleep: 24 } };
  const result = M.validateConcessions(sample, viaSleep);
  eq(result.ok, false, "protected rejected");
  check(result.errors.some((e) => e.blockId === "sleep" && /cannot give way/.test(e.message)), "explains why");
  eq(M.canSave(sample, viaSleep), false, "save gate also rejects");
});

test("fixed concessions are rejected by direct model call", () => {
  const viaClasses = { ...referenceDecision, concessions: { classes: 24 } };
  eq(M.validateConcessions(sample, viaClasses).ok, false, "fixed rejected");
  eq(M.canSave(sample, viaClasses), false, "save gate also rejects");
});

test("unknown block ids are rejected", () => {
  const unknown = { ...referenceDecision, concessions: { "not-a-block": 24 } };
  eq(M.validateConcessions(sample, unknown).ok, false, "unknown id rejected");
  eq(M.canSave(sample, unknown), false, "save gate also rejects");
});

test("single-block over-concession is rejected (a block may reach 0, never below)", () => {
  const tooMuch = { ...referenceDecision, concessions: { "side-project": 22 } };
  eq(M.validateConcessions(sample, tooMuch).ok, false, "22 ticks from a 20-tick block");
  const exactlyAll = { candidateName: "Side push", candidateTicks: 20, concessions: { "side-project": 20 } };
  eq(M.validateConcessions(sample, exactlyAll).ok, true, "conceding the whole block is allowed");
});

test("negative and off-grid concession amounts are rejected", () => {
  const neg = { ...referenceDecision, concessions: { "side-project": -2 } };
  eq(M.validateConcessions(sample, neg).ok, false, "negative");
  const offGrid = { ...referenceDecision, concessions: { "side-project": 2.5 } };
  eq(M.validateConcessions(sample, offGrid).ok, false, "off-grid");
});

test("receipt reconciles to 336 ticks on both sides for the reference scenario", () => {
  const receipt = M.deriveReceipt(sample, referenceDecision);
  eq(receipt.beforeTotal, 336, "before total");
  eq(receipt.afterTotal, 336, "after total");
  const ft = receipt.tradeoffs.find((t) => t.id === "free-time");
  check(ft, "Tradeoffs names Free Time");
  eq(ft.beforeTicks, 8, "Free Time before (4 h)");
  eq(ft.afterTicks, 0, "Free Time after (0 h)");
  const sp = receipt.tradeoffs.find((t) => t.id === "side-project");
  check(sp, "Tradeoffs names Side project");
  eq(sp.beforeTicks, 20, "Side project before (10 h)");
  eq(sp.afterTicks, 4, "Side project after (2 h)");
  eq(receipt.tradeoffs.length, 2, "exactly the two conceded blocks");
});

test("After week labels the candidate as a fixed new commitment and keeps every other block", () => {
  const receipt = M.deriveReceipt(sample, referenceDecision);
  const candidate = receipt.after.find((b) => b.id === "candidate");
  check(candidate, "candidate present in After");
  eq(candidate.name, "Weekend hackathon", "candidate name");
  eq(candidate.ticks, 24, "candidate hours");
  eq(candidate.type, "fixed", "candidate is fixed");
  eq(candidate.label, "new commitment", "candidate label");
  const afterSp = receipt.after.find((b) => b.id === "side-project");
  eq(afterSp.ticks, 4, "Side project reduced to 2 h");
  const afterSleep = receipt.after.find((b) => b.id === "sleep");
  eq(afterSleep.ticks, 112, "protected Sleep untouched");
  const afterFt = receipt.after.find((b) => b.id === "free-time");
  eq(afterFt.ticks, 0, "Free Time lands on baseline Free Time minus its concession");
});

test("receipt for a 2 h candidate covered by Free Time alone names Free Time 4 h -> 2 h", () => {
  const decision = { candidateName: "Library shift", candidateTicks: 4, concessions: { "free-time": 4 } };
  eq(M.canSave(sample, decision), true, "save allowed");
  const receipt = M.deriveReceipt(sample, decision);
  eq(receipt.beforeTotal, 336, "before total");
  eq(receipt.afterTotal, 336, "after total");
  eq(receipt.tradeoffs.length, 1, "one named tradeoff");
  eq(receipt.tradeoffs[0].id, "free-time", "Tradeoffs names Free Time");
  eq(receipt.tradeoffs[0].beforeTicks, 8, "4 h before");
  eq(receipt.tradeoffs[0].afterTicks, 4, "2 h after");
  const candidate = receipt.after.find((b) => b.id === "candidate");
  eq(candidate.label, "new commitment", "labeled in After");
  eq(receipt.after.find((b) => b.id === "free-time").ticks, 4, "Free Time remainder");
});

test("zero-amount concessions do not appear in Tradeoffs", () => {
  const decision = {
    ...referenceDecision,
    concessions: { "free-time": 8, "side-project": 16, study: 0 },
  };
  eq(M.canSave(sample, decision), true, "zero concession does not break the gate");
  eq(M.deriveReceipt(sample, decision).tradeoffs.length, 2, "zero concession omitted");
});

// --- Slice 3: persistence round-trip and malformed-storage guard --------------

function makeStore(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function persistedPayload(decision) {
  return JSON.stringify({ version: 1, baseline: M.sampleBaseline(), decision });
}

test("a valid saved state round-trips through storage", () => {
  const store = makeStore();
  const writer = createStorage(store);
  eq(writer.save(M.sampleBaseline(), referenceDecision).ok, true, "save ok");
  const loaded = createStorage(store).load();
  eq(loaded.writeBlocked, false, "not write-blocked");
  eq(loaded.warning, null, "no warning");
  eq(loaded.baseline.blocks.length, 8, "baseline restored");
  eq(loaded.decision.candidateName, "Weekend hackathon", "decision name restored");
  eq(loaded.decision.candidateTicks, 24, "decision ticks restored");
  eq(loaded.decision.concessions["side-project"], 16, "concessions restored");
});

test("a saved null decision round-trips as null", () => {
  const store = makeStore({ [STORAGE_KEY]: persistedPayload(null) });
  const loaded = createStorage(store).load();
  eq(loaded.writeBlocked, false, "not write-blocked");
  eq(loaded.decision, null, "decision null");
});

test("P1: a payload with NO decision field is malformed, not a clean save", () => {
  const payload = JSON.stringify({ version: 1, baseline: M.sampleBaseline() });
  eq(validatePersisted(JSON.parse(payload)), false, "validator rejects missing decision field");
  const loaded = createStorage(makeStore({ [STORAGE_KEY]: payload })).load();
  eq(loaded.writeBlocked, true, "write-blocked");
  check(loaded.warning, "warning exposed for the banner");
  eq(loaded.baseline.blocks.length, 8, "sample week in memory");
  eq(loaded.decision, null, "no decision trusted");
});

test("unparseable JSON is malformed and blocks writes", () => {
  const loaded = createStorage(makeStore({ [STORAGE_KEY]: "{not json" })).load();
  eq(loaded.writeBlocked, true, "write-blocked");
  check(loaded.warning, "warning exposed");
});

test("wrong-shaped payloads are malformed", () => {
  const cases = {
    "a bare array": "[]",
    "no version": JSON.stringify({ baseline: M.sampleBaseline(), decision: null }),
    "unknown version": JSON.stringify({ version: 2, baseline: M.sampleBaseline(), decision: null }),
    "baseline not an object": JSON.stringify({ version: 1, baseline: 42, decision: null }),
    "rule-violating baseline": JSON.stringify({
      version: 1,
      baseline: { blocks: [block("a", "One", 400, "fixed")] },
      decision: null,
    }),
  };
  for (const [label, payload] of Object.entries(cases)) {
    const loaded = createStorage(makeStore({ [STORAGE_KEY]: payload })).load();
    eq(loaded.writeBlocked, true, `${label} write-blocked`);
  }
});

test("malformed stored decisions are rejected, never partially trusted", () => {
  const shapes = {
    "decision is a string": "Weekend hackathon",
    "decision is an array": [],
    "candidateName not a string": { candidateName: 5, candidateTicks: 24, concessions: {} },
    "candidateTicks not an integer": { candidateName: "X", candidateTicks: 2.5, concessions: {} },
    "concessions not an object": { candidateName: "X", candidateTicks: 24, concessions: [] },
    "concession off-grid": { candidateName: "X", candidateTicks: 24, concessions: { study: 2.5, "free-time": 8, "side-project": 13 } },
  };
  for (const [label, decision] of Object.entries(shapes)) {
    const loaded = createStorage(makeStore({ [STORAGE_KEY]: persistedPayload(decision) })).load();
    eq(loaded.writeBlocked, true, `${label} write-blocked`);
  }
});

test("rule-violating stored decisions are malformed (sum mismatch, protected source)", () => {
  const mismatch = { candidateName: "Hackathon", candidateTicks: 24, concessions: { "free-time": 8 } };
  eq(validatePersisted(JSON.parse(persistedPayload(mismatch))), false, "sum mismatch rejected");
  const protectedSource = { candidateName: "Hackathon", candidateTicks: 24, concessions: { sleep: 24 } };
  eq(validatePersisted(JSON.parse(persistedPayload(protectedSource))), false, "protected source rejected");
  const unknown = { candidateName: "Hackathon", candidateTicks: 24, concessions: { "not-a-block": 24 } };
  eq(validatePersisted(JSON.parse(persistedPayload(unknown))), false, "unknown id rejected");
});

test("write guard: malformed load blocks every write until the explicit replace action", () => {
  const store = makeStore({ [STORAGE_KEY]: "{corrupt" });
  const storage = createStorage(store);
  const loaded = storage.load();
  eq(loaded.writeBlocked, true, "write-blocked after malformed load");

  const attempted = storage.save(M.sampleBaseline(), referenceDecision);
  eq(attempted.ok, false, "write refused");
  eq(attempted.reason, "blocked", "refused because of the guard");
  eq(store.getItem(STORAGE_KEY), "{corrupt", "corrupt bytes left untouched");

  const replaced = storage.replaceWithSample();
  eq(replaced.ok, true, "explicit replace writes the sample");
  eq(storage.isWriteBlocked(), false, "guard cleared");
  const parsed = JSON.parse(store.getItem(STORAGE_KEY));
  eq(parsed.version, 1, "sample payload versioned");
  eq(parsed.decision, null, "sample payload has no decision");
  eq(parsed.baseline.blocks.length, 8, "sample payload baseline");

  eq(storage.save(M.sampleBaseline(), null).ok, true, "writes allowed again after replace");
});

test("storage unavailable: sample loads without a warning and writes report failure", () => {
  const storage = createStorage(null);
  const loaded = storage.load();
  eq(loaded.writeBlocked, false, "no malformed guard");
  eq(loaded.warning, null, "no warning — nothing was corrupted");
  eq(loaded.storageDurable, false, "session flagged as memory-only");
  eq(loaded.baseline.blocks.length, 8, "sample week in memory");
  eq(storage.save(M.sampleBaseline(), referenceDecision).ok, false, "write fails without crashing");
});

test("load does not write, keeps a probe key, and does not overwrite a newer record", () => {
  const older = persistedPayload(referenceDecision);
  const newer = persistedPayload({
    candidateName: "Morning swim",
    candidateTicks: 6,
    concessions: { "free-time": 6 },
  });
  const probeKey = `${STORAGE_KEY}:probe`;
  const probeValue = "pre-existing-probe";
  let reads = 0;
  let setItemCalls = 0;
  let removeItemCalls = 0;
  let rejectWrites = true;
  const map = new Map([
    [STORAGE_KEY, older],
    [probeKey, probeValue],
  ]);
  const store = {
    getItem(key) {
      if (key === STORAGE_KEY) {
        reads += 1;
        // A second tab commits a newer record after this load has already
        // observed the old snapshot. Load must not write that snapshot back.
        if (reads === 1) {
          map.set(STORAGE_KEY, newer);
          return older;
        }
      }
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      setItemCalls += 1;
      if (rejectWrites) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      map.set(key, String(value));
    },
    removeItem(key) {
      removeItemCalls += 1;
      map.delete(key);
    },
  };

  const storage = createStorage(store);
  const loaded = storage.load();
  eq(setItemCalls, 0, "load performs zero setItem calls");
  eq(removeItemCalls, 0, "load performs zero removeItem calls");
  eq(map.get(probeKey), probeValue, "pre-existing probe key untouched");
  eq(map.get(STORAGE_KEY), newer, "newer concurrent record not overwritten on load");
  eq(loaded.decision.candidateName, "Weekend hackathon", "load uses the snapshot it already read");
  eq(loaded.writeBlocked, false, "valid snapshot is not the malformed guard");
  eq(loaded.storageDurable, true, "readable startup does not guess writability");

  // Save, Choose A/B, and Undo all request this same save. Edit keeps the
  // in-memory decision and does not write until the next requested save.
  const failedSave = storage.save(loaded.baseline, null);
  eq(failedSave.ok, false, "failed requested save reports failure");
  eq(failedSave.reason, "unavailable", "quota uses the unavailable reason");
  eq(setItemCalls, 1, "the failed save is the first write attempt");
  eq(removeItemCalls, 0, "a failed save does not remove keys");
  eq(map.get(STORAGE_KEY), newer, "failed save does not replace the stored record");
  eq(map.get(probeKey), probeValue, "failed save leaves the probe key alone");

  rejectWrites = false;
  eq(storage.save(M.sampleBaseline(), null).ok, true, "a later requested write succeeds");
  const writesBeforeReload = setItemCalls;
  const removesBeforeReload = removeItemCalls;
  const restored = createStorage(store).load();
  eq(setItemCalls, writesBeforeReload, "reload after recovery still does not setItem");
  eq(removeItemCalls, removesBeforeReload, "reload after recovery still does not removeItem");
  eq(restored.decision, null, "reload reads the write that succeeded");
  eq(map.get(probeKey), probeValue, "recovery leaves the probe key alone");

  let corruptWrites = 0;
  let corruptRemoves = 0;
  const corrupt = "{corrupt";
  const corruptStore = {
    getItem: (key) => (key === STORAGE_KEY ? corrupt : key === probeKey ? probeValue : null),
    setItem() {
      corruptWrites += 1;
      throw new Error("readonly");
    },
    removeItem() {
      corruptRemoves += 1;
    },
  };
  const guarded = createStorage(corruptStore);
  const malformed = guarded.load();
  eq(malformed.writeBlocked, true, "malformed data still blocks");
  eq(corruptWrites, 0, "malformed load does not write");
  eq(corruptRemoves, 0, "malformed load does not remove the probe key");
  eq(corruptStore.getItem(probeKey), probeValue, "probe key still present");
  eq(guarded.save(M.sampleBaseline(), referenceDecision).reason, "blocked", "the guard is not bypassed");
  eq(corruptStore.getItem(STORAGE_KEY), corrupt, "malformed bytes stay until replace");
  eq(corruptWrites, 0, "a blocked save never calls setItem");
  eq(corruptRemoves, 0, "a blocked save never calls removeItem");
});

test("edit and re-save derive from the original baseline, never the previous After", () => {
  const store = makeStore();
  createStorage(store).save(M.sampleBaseline(), referenceDecision);
  const loaded = createStorage(store).load();

  // The saved After week has Side project at 4 ticks (2 h).
  const after = M.deriveAfterWeek(loaded.baseline, loaded.decision);
  eq(after.find((b) => b.id === "side-project").ticks, 4, "After shows the concession");

  // Edit: keep the 12 h candidate, move the whole concession to Study instead.
  const edited = { candidateName: "Weekend hackathon", candidateTicks: 24, concessions: { study: 24 } };
  eq(M.canSave(loaded.baseline, edited), true, "edited decision valid against the baseline");
  const receipt = M.deriveReceipt(loaded.baseline, edited);
  eq(receipt.beforeTotal, 336, "before total");
  eq(receipt.afterTotal, 336, "after total");
  const study = receipt.tradeoffs.find((t) => t.id === "study");
  eq(study.beforeTicks, 56, "Study concedes from its baseline 28 h, not an After value");
  eq(study.afterTicks, 32, "Study after");
  // Nothing stacked: Side project and Free Time are untouched by the edit.
  eq(receipt.after.find((b) => b.id === "side-project").ticks, 20, "Side project back at 10 h");
  eq(receipt.after.find((b) => b.id === "free-time").ticks, 8, "Free Time back at 4 h");
});

// --- Slice 2 regression gate: invalid raw concession entries block save --------

test("P1: an extra invalid concession entry blocks save even when valid entries reconcile", () => {
  const raw = { "free-time": "4", "side-project": "8", study: "1.3" };
  const result = M.composeDecision(sample, "Weekend hackathon", "12", raw);
  eq(result.remainingTicks, 0, "valid entries reconcile");
  eq(result.canSave, false, "save stays blocked");
  check(result.invalidIds.includes("study"), "the invalid entry is identified, not dropped");
});

test("P1: fixing the invalid entry to a valid amount makes it count toward the sum", () => {
  const raw = { "free-time": "4", "side-project": "8", study: "1.5" };
  const result = M.composeDecision(sample, "Weekend hackathon", "12", raw);
  eq(result.invalidIds.length, 0, "no invalid entries");
  eq(result.remainingTicks, -3, "1.5 h over — the entry now counts");
  eq(result.canSave, false, "excess still blocks");
});

test("composeDecision blocks save on invalid candidate hours and negative concession text", () => {
  const offGridCandidate = M.composeDecision(sample, "X", "1.3", {});
  eq(offGridCandidate.hoursStatus, "invalid", "1.3 h candidate hours rejected, not rounded");
  eq(offGridCandidate.canSave, false, "save blocked");
  const negative = M.composeDecision(sample, "Weekend hackathon", "12", {
    "free-time": "4",
    "side-project": "8",
    study: "-2",
  });
  eq(negative.canSave, false, "negative concession blocks save");
  check(negative.invalidIds.includes("study"), "negative entry identified");
});

test("composeDecision accepts the reference scenario once every entry is valid", () => {
  const result = M.composeDecision(sample, "Weekend hackathon", "12", {
    "free-time": "4",
    "side-project": "8",
    study: "",
  });
  eq(result.canSave, true, "save allowed");
  eq(result.decision.candidateTicks, 24, "candidate ticks");
  eq(Object.keys(result.decision.concessions).length, 2, "empty entry is not a concession");
});

// --- Follow-up regressions: custom-id allocation across reload, full-gate readout

test("nextBlockId allocates the lowest unused custom id", () => {
  eq(M.nextBlockId([]), "custom-1", "empty draft");
  eq(M.nextBlockId(["sleep", "study"]), "custom-1", "sample ids do not collide");
  eq(M.nextBlockId(["custom-1"]), "custom-2", "persisted custom-1 is skipped");
  eq(M.nextBlockId(["custom-1", "custom-3"]), "custom-2", "gaps are reused lowest-first");
});

test("P1 regression: reload + Add a block never re-issues a persisted custom id", () => {
  // Session 1: Add a block (custom-1), fill it in, apply, persist.
  const sessionOne = {
    blocks: [
      ...M.sampleBaseline().blocks,
      block(M.nextBlockId(M.sampleBaseline().blocks.map((b) => b.id)), "Exercise", 2, "flexible"),
    ],
  };
  eq(sessionOne.blocks[8].id, "custom-1", "first added block takes custom-1");
  eq(M.validateBaseline(sessionOne).ok, true, "custom baseline valid");
  const store = makeStore();
  eq(createStorage(store).save(sessionOne, null).ok, true, "baseline persisted");

  // Session 2 (reload): the editor draft opens from the persisted blocks.
  const loaded = createStorage(store).load();
  eq(loaded.baseline.blocks.some((b) => b.id === "custom-1"), true, "custom-1 restored");
  // Add a block must allocate from existing ids, not a reset per-session counter.
  const addedId = M.nextBlockId(loaded.baseline.blocks.map((b) => b.id));
  eq(addedId, "custom-2", "reload + Add allocates a fresh id");
  const sessionTwo = {
    blocks: [...loaded.baseline.blocks, block(addedId, "Volunteer", 2, "flexible")],
  };
  const validation = M.validateBaseline(sessionTwo);
  eq(validation.ok, true, "no duplicate-id error after reload + Add");
  eq(validation.errors.some((e) => e.field === "id"), false, "no internal id error to surface");
});

test("readout gate: an over-capacity concession reconciles the sum but canSave stays false", () => {
  // The exact P1 readout case: candidate 12 h, Side project conceding 12 h of
  // its 10 h — the sum matches, so a naive readout says "You can save".
  const result = M.composeDecision(sample, "Weekend hackathon", "12", { "side-project": "12" });
  eq(result.remainingTicks, 0, "sum reconciles");
  eq(result.invalidIds.length, 0, "entry parses fine");
  eq(result.canSave, false, "full gate still blocks");
  const concessionErrors = M.validateConcessions(sample, result.decision).errors;
  check(concessionErrors.some((e) => /Cannot concede more/.test(e.message)), "over-capacity reason available");
});

test("readout gate: a duplicate candidate name reconciles the sum but canSave stays false", () => {
  const result = M.composeDecision(sample, "Study", "12", { "free-time": "4", "side-project": "8" });
  eq(result.remainingTicks, 0, "sum reconciles");
  eq(result.canSave, false, "duplicate name blocks the full gate");
  const nameErrors = M.validateCandidate(sample, { name: result.decision.candidateName, ticks: 24 }).errors;
  check(nameErrors.some((e) => e.field === "name"), "name reason available");
});

// --- A/B comparison: one gate, one untouched baseline --------------------------

const planAInputs = {
  candidateName: "Weekend hackathon",
  candidateHoursText: "12",
  concessionTexts: { "free-time": "4", "side-project": "8" },
};
const planBInputs = {
  candidateName: "Morning swim",
  candidateHoursText: "3",
  concessionTexts: { "free-time": "3" },
};

test("comparePlans runs both drafts through the same gate against the same baseline object", () => {
  const comparison = M.comparePlans(sample, planAInputs, planBInputs);
  eq(comparison.baseline, sample, "same baseline reference — neither plan gets a derived week");
  eq(comparison.planA.canSave, true, "Plan A valid and reconciled");
  eq(comparison.planB.canSave, true, "Plan B valid and reconciled");
});

test("equal-baseline independence: Plan A draining a block never borrows from Plan B's capacity", () => {
  const draining = {
    candidateName: "Big push",
    candidateHoursText: "14",
    concessionTexts: { "side-project": "10", "free-time": "4" },
  };
  const fullSideProject = {
    candidateName: "Side focus",
    candidateHoursText: "10",
    concessionTexts: { "side-project": "10" },
  };
  const comparison = M.comparePlans(sample, draining, fullSideProject);
  eq(comparison.planA.canSave, true, "Plan A concedes all 10 h of Side project against the baseline");
  eq(comparison.planB.canSave, true, "Plan B still sees the full baseline 10 h — nothing stacked");
  const overCapacity = {
    candidateName: "Too much",
    candidateHoursText: "12",
    concessionTexts: { "side-project": "12" },
  };
  eq(M.comparePlans(sample, draining, overCapacity).planB.canSave, false, "over-capacity against the same baseline stays blocked");
});

test("an invalid extra concession blocks only its own plan", () => {
  const withInvalid = {
    ...planAInputs,
    concessionTexts: { "free-time": "4", "side-project": "8", study: "1.3" },
  };
  const comparison = M.comparePlans(sample, withInvalid, planBInputs);
  eq(comparison.planA.remainingTicks, 0, "Plan A's valid entries reconcile");
  eq(comparison.planA.canSave, false, "Plan A blocked by the invalid entry");
  check(comparison.planA.invalidIds.includes("study"), "the invalid entry is identified, not dropped");
  eq(comparison.planB.canSave, true, "Plan B unaffected");
});

test("choosing persists exactly one decision; the unchosen plan leaves no trace", () => {
  const store = makeStore();
  const comparison = M.comparePlans(sample, planAInputs, planBInputs);
  eq(createStorage(store).save(comparison.baseline, comparison.planB.decision).ok, true, "chosen Plan B saved");
  const parsed = JSON.parse(store.getItem(STORAGE_KEY));
  eq(parsed.version, 1, "still storage v1");
  eq(parsed.decision.candidateName, "Morning swim", "only the chosen plan persisted");
  eq(JSON.stringify(parsed).includes("Weekend hackathon"), false, "the unchosen plan is absent from storage");
  const loaded = createStorage(store).load();
  eq(loaded.writeBlocked, false, "clean load");
  eq(loaded.decision.candidateName, "Morning swim", "reload restores the chosen plan only");
});

test("the chosen plan's persisted receipt reconciles to 336 ticks on both sides", () => {
  const store = makeStore();
  const comparison = M.comparePlans(sample, planAInputs, planBInputs);
  createStorage(store).save(comparison.baseline, comparison.planB.decision);
  const loaded = createStorage(store).load();
  const receipt = M.deriveReceipt(loaded.baseline, loaded.decision);
  eq(receipt.beforeTotal, 336, "before total");
  eq(receipt.afterTotal, 336, "after total");
  eq(receipt.candidateName, "Morning swim", "receipt names the chosen commitment");
  eq(receipt.tradeoffs.length, 1, "one named source");
  eq(receipt.tradeoffs[0].id, "free-time", "Free Time named");
  eq(receipt.tradeoffs[0].beforeTicks, 8, "Free Time 4 h before");
  eq(receipt.tradeoffs[0].afterTicks, 2, "Free Time 1 h after");
  eq(receipt.after.find((b) => b.id === "side-project").ticks, 20, "Side project untouched by the chosen plan");
});

test("comparison against a custom baseline uses its blocks and capacities", () => {
  const custom = {
    blocks: [...M.sampleBaseline().blocks, block("custom-1", "Exercise", 2, "flexible")],
  };
  eq(M.validateBaseline(custom).ok, true, "custom baseline valid");
  const fits = { candidateName: "Run club", candidateHoursText: "1", concessionTexts: { "custom-1": "1" } };
  const tooBig = { candidateName: "Run club", candidateHoursText: "1.5", concessionTexts: { "custom-1": "1.5" } };
  const comparison = M.comparePlans(custom, fits, tooBig);
  eq(comparison.planA.canSave, true, "the custom flexible block can fund a plan");
  eq(comparison.planB.canSave, false, "over-capacity against the custom block stays blocked");
  const receipt = M.deriveReceipt(custom, comparison.planA.decision);
  eq(receipt.beforeTotal, 336, "custom before total");
  eq(receipt.afterTotal, 336, "custom after total");
  eq(receipt.after.find((b) => b.id === "custom-1").ticks, 0, "custom block reduced by its concession");
});

test("undo after choosing a compared plan restores the plain baseline; a later edit never stacks", () => {
  const store = makeStore();
  const comparison = M.comparePlans(sample, planAInputs, planBInputs);
  createStorage(store).save(comparison.baseline, comparison.planB.decision); // choose B
  const chosen = createStorage(store).load();
  eq(chosen.decision.candidateName, "Morning swim", "chosen plan persisted");
  eq(createStorage(store).save(chosen.baseline, null).ok, true, "undo persists a null decision");
  const undone = createStorage(store).load();
  eq(undone.decision, null, "decision cleared");
  eq(M.baselineSum(undone.baseline), 328, "baseline untouched by choose + undo");
  // Editing after the comparison still recomputes from the original baseline.
  const edited = { candidateName: "Morning swim", candidateTicks: 6, concessions: { study: 6 } };
  eq(M.canSave(undone.baseline, edited), true, "edited decision valid against the baseline");
  const receipt = M.deriveReceipt(undone.baseline, edited);
  eq(receipt.beforeTotal, 336, "before total");
  eq(receipt.afterTotal, 336, "after total");
  eq(receipt.after.find((b) => b.id === "free-time").ticks, 8, "Free Time back at its baseline 4 h — nothing stacked");
  eq(receipt.tradeoffs.find((t) => t.id === "study").beforeTicks, 56, "Study concedes from its baseline 28 h");
});

// --- Reporting (Node + browser) ----------------------------------------------

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

if (typeof document !== "undefined") {
  const list = document.getElementById("results");
  for (const r of results) {
    const li = document.createElement("li");
    li.className = r.ok ? "pass" : "fail";
    li.textContent = r.ok ? `PASS ${r.name}` : `FAIL ${r.name} — ${r.error}`;
    list.appendChild(li);
  }
  const summary = document.getElementById("summary");
  summary.textContent = `${passed}/${results.length} passed` + (failed.length ? ` — ${failed.length} FAILED` : "");
  summary.className = failed.length ? "fail" : "pass";
}

if (typeof process !== "undefined" && process && typeof process.exit === "function") {
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : " — " + r.error}`);
  }
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
