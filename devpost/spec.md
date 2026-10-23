---
doc: spec
status: approved
---

<!-- Drafted, reviewed and approved 2026-10-04. All consequential technical choices below were supplied
     and approved by Codex, the user's expressly delegated supervisor/product
     owner — not from a live interview with the learner. Implementation detail
     that follows mechanically from those choices (file layout, function
     boundaries, storage field names) is filled in by Kimi and labeled as such.
     Source documents: `scope.md` (status: approved), `prd.md` (status:
     approved), `learner-profile.md` (status: complete). No external search was
     performed for this document — model routing permits search only for K2.7;
     doc links below are stable URLs from model knowledge, flagged where
     unverified. -->

# GiveWay — Technical Spec

## How This Works, In Plain Language

GiveWay is a single web page that runs entirely in the browser. There is no server of our own, no account system, and no AI inside the product. The page is one HTML file plus one stylesheet plus three small JavaScript modules, and the browser loads them as-is — nothing needs to be compiled or installed.

The page has three JavaScript pieces with strict boundaries:

- **The time model** (`src/model.js`) — a pure calculator. It knows that a week is 168 hours, kept internally as 336 half-hour "ticks" so arithmetic never drifts into decimals like 0.30000000004. It validates a baseline, derives Free Time as whatever is left over, checks whether a set of named concessions exactly covers a candidate commitment, and derives the After week and the receipt. It never touches the page or storage — it only takes data in and returns data out, which is what makes it directly testable.
- **The storage layer** (`src/storage.js`) — the only code allowed to read or write the browser's `localStorage` (a small key-value store the browser keeps per site, surviving refreshes). It saves and loads the baseline and the one active decision under a versioned key, and it validates whatever it reads before trusting it. If the saved data is malformed, it refuses to write anything until the user explicitly clicks "Use sample and replace saved data," so a corrupt save can never be silently overwritten.
- **The DOM controller** (`src/app.js`) — renders the four zones (ribbon/baseline, composer, concessions, receipt), wires up labeled inputs and keyboard focus, and translates between human-readable hours at the screen and integer ticks inside the model. Hours become ticks exactly once on input and become hours again exactly once on display.

The baseline (your named blocks) is never mutated by a decision. A saved decision is just the candidate plus a list of named concessions; the After week and the receipt are re-derived from the untouched baseline every time the page renders. That is why undo and edit can never double-count: there is nothing to compound.

Why this shape and not something more elaborate: the product's whole force is in honest, exact accounting of a fixed 168-hour budget, and every PRD behavior is local, single-user, and deterministic. A framework, backend, or database would add setup, failure modes, and deploy steps without proving anything about the kernel. Codex chose the smallest architecture that can express the kernel faithfully — and it happens to also make the core logic testable as a pure module with zero dependencies.

## The Core Journey Through the System

Traces `prd.md > The Core Journey` through the pieces above.

1. **Arrive.** The browser loads `index.html`, which loads `src/app.js` as an ES module. `app.js` asks `storage.js` for the saved state. On first use there is none, so `model.js`'s sample-baseline factory supplies the synthetic sample week; `app.js` renders the 168 h ribbon and the named baseline blocks. If saved data exists and validates, it is used instead; if it is malformed, the sample week loads **in memory only** with a warning banner and all writes disabled until the explicit replace action (`prd.md > One active decision — edit, undo, persistence`).
2. **Compose.** The user types a candidate name and weekly hours into labeled inputs. `app.js` converts the hours to integer ticks (×2) and hands them to `model.js`, which rejects zero, negative, non-finite, or non-half-hour values with a field-level error (`prd.md > The commitment composer`).
3. **Confront the full ask.** For any candidate with positive ticks, `model.js` computes "still to allocate = candidate ticks" and `app.js` renders one named concession control per **flexible** block — Free Time included, since it is derived as a named flexible block — plus the live readout. Save renders disabled.
4. **Concede explicitly.** Each concession edit is re-validated by `model.js`: source block must be flexible, amount must be non-negative ticks capped at that block's current hours. The readout re-derives on every change: `still = candidate − Σ(concessions)`; insufficient and excess both block save (`prd.md > Named concessions and live allocation readout`).
5. **Save and read the receipt.** When `model.js` reports exact reconciliation (positive candidate ticks, concessions summing exactly, all sources flexible), save enables. On save, `storage.js` persists `{ baseline, decision }` under the versioned key. `app.js` then re-renders from the pure derivation: the receipt shows **Before → Tradeoffs → After** (every conceded block named with before → after hours, Free Time included), and the top ribbon switches to the After week, where the candidate appears labeled "new commitment" and treated as fixed (`prd.md > The Before → Tradeoffs → After receipt`).
6. **Return.** On refresh, `storage.js` loads and validates the saved state and the page renders baseline, saved decision, receipt, and After ribbon exactly as left. **Undo** clears the decision (ribbon returns to the plain baseline); **Edit** repopulates the composer/concessions from the stored decision. Both re-derive from the untouched baseline, so nothing stacks (`prd.md > One active decision — edit, undo, persistence`).

## Stack

Chosen by **Codex** (delegated supervisor/product owner); rationale and tradeoffs recorded with its agreement:

- **Vanilla HTML + CSS + ES-module JavaScript, no framework, no build step.** Codex's choice: the app is one page of deterministic local accounting; a framework adds setup and debugging surface without proving the kernel. Accepted tradeoff: manual DOM updates instead of declarative rendering — fine at this page's size, and the strict model/controller split keeps the DOM code thin.
- **No backend, no runtime AI.** Codex's choice, matching `scope.md > The POC Boundary` and `prd.md > Non-Goals` ("No AI features inside the product"). Everything is browser-local; privacy by construction.
- **No third-party JavaScript dependencies at all.** Dependency-light by Codex's decision: the only runtime requirements are a modern browser and Python 3's standard library for the local static server. No npm, no lockfile, no CDN scripts — the app also works fully offline.
- **`localStorage` for persistence** with a versioned key and schema (see Data Model). Carried from `prd.md > One active decision — edit, undo, persistence`.
- **Serving for local runs:** Python 3 standard-library `http.server` (already present on the dev machine; nothing to install).
- **Verification tooling:** a tiny zero-dependency assertion harness written for this project (`tests/`), run as a browser test page against `src/model.js`; end-to-end in a real browser via the ego-browser skill after the build (Codex's approved verification approach).

Documentation links (stable URLs from model knowledge; **not freshly verified** — no external search was performed per the K2.7-only search routing. If a link 404s, treat the browser/runtime's own local docs as authoritative):

- Python `http.server` module: https://docs.python.org/3/library/http.server.html
- MDN — JavaScript modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- MDN — `Window.localStorage`: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- MDN — `label` element (form accessibility): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label

## Where It Runs and How Someone Tries It

- **Runtime:** any modern desktop or mobile browser with ES-module support. No API keys, no network, no install.
- **Exact start (from the project root, the directory containing `index.html`):**

  ```
  python3 -m http.server 4173 --bind 127.0.0.1
  ```

  Then open **http://127.0.0.1:4173/** . (Serving from the project root is required so the ES-module imports resolve over HTTP; `file://` will not load modules.)
- **Tests:** with the same server running, open **http://127.0.0.1:4173/tests/tests.html** for the pure-model test page.
- **Demo recording (for `6-ship`):** record the one-minute loop from `scope.md > What "Working" Looks Like` — sample week loads and sums to 168 h; 12 h candidate blocked with the full 12 h still to allocate; explicit "Free Time −4 h" and "Side project −8 h" concessions reconcile to zero; save; receipt reads correctly; refresh and the state persists. A local run is sufficient for the required video.
- **Submission:** requires the short demo video plus a public GitHub repository (both deferred to `6-ship`, after Codex's local browser acceptance).
- **Deployment:** optional, later. Codex's decision: static hosting (any static host can serve these files unchanged) may be considered after local acceptance; it is not required and never substitutes for video + repo.

## Look and Feel

Carried from `prd.md > Look and Feel` (Codex's delegated direction); no re-discovery:

- **Mood:** calm editorial *ledger* — a well-set page of accounts, not a SaaS dashboard. Explicitly avoid generic AI-app chrome: no purple-blue gradients, no glowing cards, no chat-like UI.
- **Color:** warm paper background (e.g. an off-white with a warm tint), near-black/navy text, a **single coral accent reserved for warnings and the still-to-allocate state** — nowhere else, so it keeps its meaning.
- **Typography:** spacious — generous line height and whitespace; numbers set like ledger entries. System serif for headings/figures and system sans for controls, so no external font dependency (consistent with the no-CDN stack).
- **Motion:** none required; hour movement is text/number updates only (`scope.md > What "Working" Looks Like`).
- **Layout:** one responsive page, four zones in vertical reading order, desktop and mobile widths (`prd.md > Screens and Layout`).
- The stack fully honors this direction — plain CSS with custom properties; nothing here needs a styling framework.

## Components

### Pure time model (`src/model.js`)

The heart of the app and the only place arithmetic happens. Pure functions in, data out; no DOM, no storage imports, so it is directly unit-testable. Implements `prd.md > The weekly baseline and ribbon`, `prd.md > The commitment composer`, `prd.md > Named concessions and live allocation readout`, `prd.md > The Before → Tradeoffs → After receipt`.

Responsibilities:

- **Tick arithmetic.** All hours are integer half-hour ticks internally (week = 336 ticks; 12 h = 24 ticks). Conversion happens only at the UI boundary (`app.js` converts hours → ticks on input, ticks → hours for display). Codex's choice, to eliminate decimal drift such as `0.1 + 0.2` in money-style hour math. The input conversion must **reject** an off-grid value such as 1.3 h; it must never round it to a nearby tick. Accept/reject helpers reject non-integers, non-finite numbers, and anything outside the 0.5 h grid at the boundary.
- **Baseline representation and validation.** A baseline is a list of blocks, each `{ id, name, ticks, type }` with a stable string `id`, unique non-empty name, non-negative integer ticks, and `type ∈ {fixed, flexible, protected}`. Validation enforces: non-empty **unique IDs** that remain stable across name/hour edits; no user block with reserved ID `free-time` or reserved name `Free Time` (case-insensitive after trimming); unique non-empty names; non-negative, finite, half-hour-aligned hours; sum of blocks ≤ 336 ticks (overfull input blocked). The same checks run when loading stored data. Validation returns structured per-field errors for the UI to place.
- **Free Time derivation.** Free Time is **never stored or typed**; `deriveFreeTime(baseline)` returns the named flexible block `{ id: "free-time", name: "Free Time", ticks: 336 − Σ(other blocks), type: "flexible" }` with the reserved stable id `free-time`, so concessions can reference it exactly like any other block. Blocks plus derived Free Time always sum to 336 by construction.
- **Sample baseline factory.** Returns the fixed synthetic sample week from `prd.md > The weekly baseline and ribbon` (Sleep 56 h protected … Free Time derived at 4 h flexible), with fixed stable ids so tests and receipts are reproducible.
- **Candidate validation.** Name non-empty and distinct from every baseline block name, including derived Free Time; ticks positive (zero is not a decision), finite, half-hour-aligned. (Baseline blocks may be 0 h; candidates may not.)
- **Concession validation and save gate.** `validateConcessions(baseline, decision)` rejects any concession that: references an unknown block id; references a **protected or fixed** block — rejected even if it arrives via stale DOM or loaded storage, not just via the UI; is negative, non-integer, off-grid, or exceeds that block's current ticks (a block may go to 0, never below). `canSave(baseline, decision)` validates the candidate, all concession sources and amounts **against that baseline**, then returns true only when `Σ(valid flexible concessions) === candidateTicks` exactly — insufficient and excess both block, because the week is a closed 336-tick system.
- **After-week and receipt derivation.** `deriveAfterWeek(baseline, decision)` and `deriveReceipt(baseline, decision)` compute, **fresh from the untouched baseline on every render**: Before = baseline blocks + derived Free Time; Tradeoffs = the candidate plus each named concession with before → after ticks (Free Time concessions listed like any other); After = baseline with concessions subtracted, the candidate appended as a block labeled "new commitment" with type `fixed`, and Free Time re-derived (which lands exactly on baseline Free Time − its explicit concession, because concessions sum to the candidate). Both Before and After total exactly 336 ticks; any receipt that does not reconcile is a bug the model tests must catch. The model never mutates the baseline and never accumulates decisions — edit/undo recompute from the same baseline, so double-counting is impossible by construction.

### Storage layer (`src/storage.js`)

The only module that touches `localStorage`. Implements `prd.md > One active decision — edit, undo, persistence`, including malformed-storage recovery.

Responsibilities:

- **Versioned key and schema.** Single key `giveway:v1` holding `{ version: 1, baseline, decision }`. A version bump later (e.g. `giveway:v2`) reads/migrates or safely ignores the old key; unknown versions are treated as malformed.
- **Load + validate.** On load, JSON-parse then validate the full shape with `model.js`'s validators: baseline rules, decision rules (concessions reference flexible blocks by known id, sum exactly to candidate ticks), and cross-checks. Anything unparseable, wrong-shaped, or rule-violating is **malformed**.
- **Malformed-storage guard (Codex's decision).** On malformed data: return the sample baseline in memory, set a `writeBlocked` flag, and expose the reason for a warning banner. While `writeBlocked` is true, **no write path executes** — editing in memory cannot silently overwrite the corrupt save. The only escape is the explicit user action "Use sample and replace saved data," which writes the sample over the key and clears the flag. This prevents a parse error from destroying possibly-recoverable user data.
- **Save / clear decision.** Writes `{ version, baseline, decision }` on save and baseline edits; `decision: null` on undo. All writes go through this module so the guard cannot be bypassed by the controller.

### DOM controller (`src/app.js`)

The only module that touches the document. Renders the four zones from `prd.md > Screens and Layout`, in vertical order, and re-renders derived state on every change (baseline is rendered from storage state; ribbon, concessions readout, receipt from `model.js` derivations). Implements `prd.md > Accessibility of controls` and the state/error surfaces of `prd.md > States and Boundaries`.

Responsibilities:

- **Zone 1 — ribbon and baseline.** The 168 h ribbon and the named block list with hours (ticks → hours for display) and classification. Shows the **After** week while a decision is saved, the plain baseline otherwise. Hosts the build-your-own baseline editor (per-row labeled name/hours/type inputs, add/remove row, derived Free Time shown read-only, per-field inline errors from `model.js` validation). Baseline edits are refused while a decision is saved, with an explanation to undo first — keeping the receipt's Before honest.
- **Zone 2 — commitment composer.** Labeled name and weekly-hours inputs plus the save control; inline errors for empty name and invalid hours; save enabled only when `model.js` reports exact reconciliation.
- **Zone 3 — concession controls and live readout.** One named, labeled concession input per flexible block (derived Free Time included); protected and fixed blocks render no control. The live readout counts down from the candidate's full hours: "still to allocate: X h" or the overage, in the coral warning color.
- **Zone 4 — receipt.** Before → Tradeoffs → After, all hours displayed from ticks; every conceded block named with before → after hours; the new commitment labeled "new commitment" and fixed; totals shown at 168 h on both sides. No causal claims anywhere in the copy.
- **Edit / Undo controls** for the saved decision, and the **"Use sample and replace saved data"** button shown only with the malformed-storage warning.
- **Accessibility.** Every input has an associated `label`; visible focus states; everything operable by keyboard (inputs, steppers, buttons, explicit confirm); status changes (readout, errors, save availability) announced via an `aria-live` region. **No drag-and-drop anywhere** (`prd.md > Accessibility of controls`).

### Styles (`styles.css`)

Implements `prd.md > Look and Feel` (see Look and Feel above): warm paper, near-black/navy text, single coral accent for warnings/readout, spacious ledger typography, responsive one-column reading order across desktop and mobile, visible focus rings. Plain CSS with custom properties — no framework, consistent with the stack.

### Pure-model test harness (`tests/`)

Implements the verification plan agreed by Codex for the model layer. A tiny zero-dependency assertion helper plus `model.test.js`, run in the browser at `tests/tests.html` (same server, no install) so tests exercise the exact modules the app ships.

Coverage anchored to the PRD checkboxes: sample week sums to 336 ticks (168 h); baseline validation rejects duplicate/empty names, duplicate/empty/reserved IDs, a custom Free Time name, negative/NaN/non-0.5 hours, and over-168 sums; candidate validation rejects duplicate baseline names, 0/negative/NaN/off-grid; UI-boundary conversion rejects 1.3 h rather than rounding it; the reference scenario (12 h candidate, Free Time −4 h, Side project −8 h → readout 0, save allowed; less or more stays blocked); protected/fixed concessions rejected including by-id via direct model calls (the stale-DOM/storage path); over-concession of a single block rejected; receipt reconciliation for the reference scenario and the 2 h Free-Time-only case (Tradeoffs names Free Time 4 h → 2 h; After labels "new commitment", both totals 168 h); edit/re-save derives from the original baseline, not the previous After; malformed storage payloads rejected by the storage validator.

## Data Model

All times are integer half-hour **ticks** (1 tick = 0.5 h; week = 336 ticks) everywhere except the UI boundary. Free Time is always derived, never stored.

**Persisted shape** — `localStorage["giveway:v1"]`:

```json
{
  "version": 1,
  "baseline": {
    "blocks": [
      { "id": "sleep",        "name": "Sleep",          "ticks": 112, "type": "protected" },
      { "id": "classes",      "name": "Classes",        "ticks": 48,  "type": "fixed" },
      { "id": "study",        "name": "Study",          "ticks": 56,  "type": "flexible" },
      { "id": "side-project", "name": "Side project",   "ticks": 20,  "type": "flexible" },
      { "id": "meals-care",   "name": "Meals and care", "ticks": 42,  "type": "fixed" },
      { "id": "travel",       "name": "Travel",         "ticks": 14,  "type": "fixed" },
      { "id": "rest",         "name": "Rest",           "ticks": 28,  "type": "protected" },
      { "id": "admin",        "name": "Admin",          "ticks": 8,   "type": "fixed" }
    ]
  },
  "decision": null
}
```

A saved **decision** (replaces `null`):

```json
{
  "candidateName": "Weekend hackathon",
  "candidateTicks": 24,
  "concessions": { "free-time": 8, "side-project": 16 }
}
```

**Where each piece of data lives, how it updates, what happens on return:**

- **Baseline blocks** — authored in the baseline editor (or from the sample factory on first use), validated by `model.js`, persisted by `storage.js` on every accepted change. On return: loaded and validated from `localStorage`; Free Time re-derived at render. Locked while a decision is saved.
- **The active decision** — lives in memory while composing (candidate + concession map keyed by stable block id); persisted only at the exact-reconciliation save gate. On return: reloaded and re-validated; an invalid stored decision is treated as malformed storage, not partially trusted.
- **Free Time, the After week, and the receipt** — **derived, never stored**. Recomputed by `model.js` from baseline (+ decision) on every render. This is why refresh, edit, and undo cannot drift or double-count: there is a single source of truth (baseline + decision) and everything else is a projection.
- **The malformed-storage warning state** — in memory only (`writeBlocked` flag in `storage.js`), re-detected on every load; the corrupt key bytes are left untouched until the explicit replace action.

## File Structure

Derived from the agreed architecture (Kimi implementation detail within Codex's choices):

```
project/
├── index.html          # the single page: four zones; loads src/app.js as an ES module
├── styles.css          # ledger look: warm paper, navy text, coral warning accent
├── src/
│   ├── model.js        # pure time model — ticks, validation, Free Time, save gate, receipt derivation (no DOM, no storage)
│   ├── storage.js      # versioned localStorage load/validate/save; malformed-data write guard
│   └── app.js          # DOM controller — renders zones, wires labeled inputs, hours↔ticks at the boundary
├── tests/
│   ├── tests.html      # zero-dependency browser test runner page
│   └── model.test.js   # pure-model tests (validation, save gate, receipt reconciliation, malformed storage)
├── devpost/            # Devpost learning workspace (this spec, scope, prd, profile)
└── README.md           # start command and how to try it (written during 5-build)
```

## External Services and Dependencies

None. No APIs, no database, no accounts, no CDN scripts or fonts, no keys, no cost. The only external pieces are:

- **Python 3 standard library** (`http.server`) for local serving — docs link in Stack; present on the dev machine; verify early in `5-build` with `python3 --version`.
- **Optional static hosting later** (Codex's decision: consider after local acceptance) — any static host serves these files as-is; target, steps, and cost to be recorded in `6-ship` if pursued.

## Important Failure Modes

- **Malformed or stale saved data** (unparseable JSON, wrong shape, rule-violating values, unknown schema version) → sample week loads **in memory** with a clear warning banner; the corrupt saved data is left untouched and all writes are disabled until the user clicks the explicit **"Use sample and replace saved data"** action. No crash, no silent overwrite (`prd.md > One active decision — edit, undo, persistence`).
- **Tampered or stale input paths** (concessions referencing protected/fixed or unknown blocks arriving via stale DOM or hand-edited storage) → rejected by `model.js` validation at the save gate and at storage load, with an explanation that the block cannot give way; the UI simply offers no such control in normal use.
- **`localStorage` unavailable or full** (private-mode restrictions, quota) → the app still works in memory for the session and says plainly that changes will not survive refresh; no crash.

## What Was Simplified and Why

- **No framework, no build step** instead of React/Vue + bundler — Codex's choice: one deterministic page does not need declarative rendering, and skipping the toolchain removes install/build failure modes entirely. A framework would add setup, a dev server, and a build pipeline without proving anything about the kernel.
- **`localStorage` with a versioned key** instead of any database or sync — carried from `scope.md > The POC Boundary`; a hosted database would add accounts, keys, and a network failure mode for a single-user local tool.
- **One active decision, derived receipts** instead of a decision history — carried from `prd.md > Deferred From the POC`; storing After states or histories would invite compounding bugs, while deriving from the untouched baseline makes correctness almost structural. A history log is a later enhancement.
- **System font stack** instead of webfonts — keeps the no-CDN, works-offline property; the ledger mood comes from spacing and restraint, not a specific typeface.
- **Zero-dependency browser test page** instead of a JS test framework — no npm install just to test pure functions; the test page runs the real shipped modules in the same browser environment the app uses.
- **Steppers/inputs with explicit confirm** instead of drag-and-drop — `prd.md > Accessibility of controls`; drag adds interaction risk and accessibility cost without proving the kernel.
- **Synthetic sample week** instead of real calendar import — `scope.md > Explicitly Cut`; the fixed sample makes the 12 h-over-4 h-free demo beat reproducible on every machine.

## Decisions and Open Issues

All consequential decisions below were made and approved by **Codex, the user's delegated supervisor/product owner**, and supplied directly for this document — none came from a live learner interview, and none should be attributed to the learner personally. Implementation details derived from those decisions (file names, the reserved `free-time` id, the `giveway:v1` key name, the test-page form) are Kimi's, marked as such.

- **Dependency-light static app: vanilla HTML/CSS/ES modules, no backend, no runtime AI** (Codex) — smallest architecture that expresses the kernel; tradeoff accepted: manual DOM rendering.
- **Run locally via `python3 -m http.server 4173 --bind 127.0.0.1` from the project root; open http://127.0.0.1:4173/; optional static hosting later** (Codex) — local run is sufficient for the required demo video; hosting is optional and deferred.
- **Strict separation: pure time model / storage validation / DOM controller + styles** (Codex) — keeps the kernel testable without a browser and keeps DOM code thin.
- **Hours stored internally as integer half-hour ticks (336/week), converted only at the UI boundary** (Codex) — eliminates floating-point drift in hour arithmetic; tradeoff accepted: every display/input site must convert, enforced by funneling conversion through `app.js`.
- **Baseline: non-empty unique stable IDs and names, ticks, fixed/flexible/protected; `free-time` ID and `Free Time` name reserved; Free Time derived as 336 − Σ(others) and shown as a named flexible block** (Codex) — sum-to-168 holds by construction and stored concessions cannot ambiguously point to more than one block.
- **Decision stores candidate name/ticks + explicit per-block concessions by stable id; After week and receipt derived from the untouched baseline on each render, never cumulatively mutated** (Codex) — undo/edit cannot double-count because there is nothing to compound.
- **Save gate: positive candidate ticks exactly equal to the sum of valid flexible concessions; protected/fixed concessions rejected even from stale DOM or storage** (Codex) — enforced in `model.js`, not the DOM, so no UI path can bypass it.
- **Versioned localStorage key/schema (`giveway:v1`)** (Codex's requirement; key name is Kimi detail) — future schema changes can migrate or fail safe.
- **Malformed storage → sample in memory + warning, writes disabled until explicit "Use sample and replace saved data" click** (Codex) — a parse error must never silently destroy saved data.
- **New commitment is fixed in After and labeled "new commitment"** (Codex) — within the single active decision it cannot itself be conceded.
- **Full click/keyboard accessibility: labeled inputs, visible focus, no drag-and-drop** (Codex, from `prd.md > Accessibility of controls`).
- **Verification: pure-model tests + ego-browser end-to-end in a real browser after the build** (Codex) — model logic proven without a browser; the full journey (reference scenario, persistence across refresh, undo/edit recompute, malformed-storage recovery) proven in one.

**One useful unknown.** Because all decisions arrived via Codex's delegated brief rather than a live interview, no personal uncertainty of the learner's surfaced to resolve — and per `learner-profile.md > Notes and Open Questions`, the learner's coding background is unestablished, so none is invented here. The closest genuine technical uncertainty, recorded for the build: the tick↔hour conversion rule is simple to state but easy to apply inconsistently (converting twice, or letting a float past the boundary). Clarification/check agreed: `5-build` lands `model.js` and its tick-conversion helpers **first**, with the pure-model tests asserting boundary behavior (e.g. 12 h ⇄ 24 ticks, off-grid rejection, 336-tick totals) before any DOM code exists; the ego-browser pass then confirms the UI shows whole/half hours everywhere. Evidence required: green `tests/tests.html` plus the browser walkthrough.

**Open issues:** none blocking. `prd.md > Resolved Questions` closed all four prior questions; the unverified doc links above are flagged to check early in `5-build`.
