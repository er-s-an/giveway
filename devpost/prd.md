---
doc: prd
status: approved
---

<!-- Drafted 2026-10-04; revised and approved 2026-10-04 per Codex's product-owner review
     (explicit named displacement for every hour — Free Time is never silently
     absorbed — plus resolutions of all four open questions). The product
     answers below were supplied by Codex, the user's expressly delegated
     product owner/supervisor, as its decisions — not from a live interview
     with the learner. The learner personally contributed no additional
     design answers for this document. Source scope: `scope.md` (status:
     approved), itself approved by Codex on 2026-10-04. -->

# GiveWay — Product Requirements

One line: a time trade-off tool for the moment *before* you accept a new commitment — the week is a fixed 168-hour budget of named blocks, and a new commitment cannot be saved until you explicitly choose which existing hours give way, producing a receipt of what you set down. For people juggling courses, work, and projects at the instant a new invitation arrives.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey

Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Arrive.** One page opens to the current week: a 168-hour ribbon across the top and the named baseline blocks below it. On first use, a synthetic sample week is already loaded — there is no setup gate.
2. **Compose.** In the commitment composer, type a candidate commitment: a name ("Weekend hackathon") and weekly hours (12 h). Hours must be positive and in 0.5 h increments — zero is not a decision.
3. **Confront the full ask.** Every hour of the candidate must be explicitly allocated: a candidate of N h starts with the full N h still to allocate, even when Free Time could hold it. The concession area appears with named concession controls — one per flexible block, Free Time included — and a live "still to allocate: N h" readout. The save control stays blocked.
4. **Concede explicitly.** Reduce specific named blocks ("Free Time −4 h", "Side project −8 h") until the named concessions total exactly the candidate's hours — no more, no less. Free Time is one named flexible block among others; it is never silently absorbed. Protected and fixed blocks offer no concession control.
5. **Save and read the receipt.** Save becomes available only at exact reconciliation. Saving produces the **Before → Tradeoffs → After** receipt: the week before, each named concession with its hours (Free Time concessions listed like any other), the week after — all numbers reconciling to 168.
6. **Return.** The baseline and the one active decision persist across refreshes. The decision can be edited or undone; both recompute from the baseline so nothing double-counts.

## Screens and Layout

One single page, responsive across desktop and mobile widths (Codex's decision; `scope.md > The POC Boundary` — "browser-local single-page app"). Four zones in vertical reading order:

1. **Weekly ribbon and baseline** (top) — a 168-hour ribbon summarizing the week, with the named baseline blocks listed with their hours and classification (fixed / flexible / protected). When a decision is saved, the ribbon shows the **After** week — the week as it now stands; the receipt below holds the clear Before view.
2. **Commitment composer** — name and weekly-hours inputs for the candidate commitment, plus the save control.
3. **Concession controls and live allocation readout** — per-block named concession controls with the live "still to allocate" readout; appears for every candidate with hours > 0, because every hour must be explicitly allocated, even when Free Time could hold it.
4. **Receipt** (bottom) — the **Before → Tradeoffs → After** receipt after save.

Navigation is scrolling on one page; there are no routes, dialogs-as-pages, or secondary screens.

## Look and Feel

Codex's delegated direction (`3-prd` design beat; scope left this open at `scope.md > Inspiration & Identity`):

- **Mood:** a calm editorial *ledger* — the app should read like a well-set page of accounts, not a SaaS tool. Deliberately avoid the generic AI-dashboard look (no purple-blue gradients, no glowing cards, no chat-like chrome).
- **Color:** warm paper background; near-black/navy text; a single coral accent reserved for warnings and the still-to-allocate state.
- **Typography:** spacious — generous line height and whitespace, letting the numbers breathe like entries in a ledger.
- **Motion:** none required. Any visual movement of hours is presentation polish, not the core mechanic (`scope.md > What "Working" Looks Like`).

## Features and Behavior

### The weekly baseline and ribbon

Source: `scope.md > The Unique Kernel`.

- The week is exactly **168 hours**, composed of named blocks. Each block has a name, an hour count, and a classification: **fixed**, **flexible**, or **protected**.
- All blocks always sum to exactly 168. A named **Free Time** block holds whatever is left over; in a custom baseline it is **derived** (168 minus the other blocks), not independently entered.
- The default synthetic sample week (loads on first use; no real schedule data, per `scope.md > Who It's For`):

  | Block | Hours | Classification |
  |---|---|---|
  | Sleep | 56 h | protected |
  | Classes | 24 h | fixed |
  | Study | 28 h | flexible |
  | Side project | 10 h | flexible |
  | Meals and care | 21 h | fixed |
  | Travel | 7 h | fixed |
  | Rest | 14 h | protected |
  | Admin | 4 h | fixed |
  | Free Time | 4 h | flexible |
  | **Total** | **168 h** | |

- A **build-your-own baseline** editor lets the user replace the sample with their own named blocks. Validation rules (all enforced at input, with the offending field marked):
  - Block names must be **unique and non-empty**; **Free Time** is reserved for the derived block and cannot also be entered as a custom block name.
  - Hours must be **non-negative, finite, and in 0.5 h increments**.
  - **Overfull input is blocked**: non-Free-Time blocks may not exceed 168 h in sum.
  - Free Time is recomputed as 168 − (sum of other blocks) and shown, not typed.

- [ ] The sample week above loads on first use and its blocks sum to exactly 168 h.
- [ ] Entering a custom baseline with duplicate names, empty names, the reserved name Free Time, negative/NaN/non-0.5-increment hours, or a sum over 168 h is rejected with the problem identified; Free Time always shows the derived remainder.

### The commitment composer

Source: `scope.md > The Core Loop`.

- Inputs: commitment **name** (non-empty and distinct from all baseline block names, including Free Time) and **weekly hours** — **positive**, finite, and in 0.5 h increments. Zero is invalid: a zero-hour commitment is not a decision. (Baseline blocks may be 0 h; candidates may not.)
- **Every candidate of N h starts with the full N h still to allocate, and Save is blocked.** Save stays blocked until named concessions from flexible blocks total exactly N h.
- **Free Time is never silently absorbed.** It is one named flexible block among others and must be conceded explicitly like any other. A 2 h candidate against 4 h of Free Time still requires the user to explicitly enter "Free Time −2 h" — and the receipt then shows that concession.

- [ ] Typing "Weekend hackathon, 12 h" against the sample week blocks save and shows the full 12 h still to allocate; explicitly entering the named concessions "Free Time −4 h" and "Side project −8 h" brings the readout to zero and unblocks save.
- [ ] A 2 h candidate with 4 h of Free Time still starts with 2 h to allocate and save blocked; explicitly entering "Free Time −2 h" reconciles it, and the receipt lists the Free Time concession.
- [ ] Candidate hours of 0, negative, NaN/infinite, or non-0.5-increment values are rejected with an inline error; nothing is saved.
- [ ] A candidate with the same name as any existing block, including Free Time, is rejected with an inline error so the receipt remains unambiguous.

### Named concessions and live allocation readout

Source: `scope.md > The Unique Kernel`, `scope.md > What "Working" Looks Like`.

- Each concession **names its source block** — "Side project −8 h" — never an unnamed aggregate. This naming is the product's core force and is non-negotiable, and it applies to Free Time exactly as to any other flexible block.
- Only **flexible** blocks (Free Time included) can be conceded in v1. **Protected** blocks (e.g. Sleep, Rest) can never be conceded; **fixed** blocks cannot be conceded in v1. Neither shows a concession control; attempting to concede them (e.g. via stale state) is rejected with an explanation.
- A concession is capped at that block's current hours (a block can go to 0 h but not below).
- The **live allocation readout** counts down from the candidate's full hours: "still to allocate: X h". Save stays blocked while the total is off — **insufficient** concessions (X h still to allocate) and **excess** concessions (Y h over) both block, because the week must reconcile to exactly 168.
- Reference scenario (the demo beat): candidate "Weekend hackathon" 12 h → the user explicitly enters concessions "Free Time −4 h" and "Side project −8 h" → after: Side project 2 h, Free Time 0 h, new commitment 12 h, total 168 h.

- [ ] With the sample week and a 12 h candidate, explicitly entering Free Time −4 h and Side project −8 h drives the readout to zero and unblocks save; entering less or more keeps it blocked with the remaining/excess amount shown.
- [ ] Sleep and Rest (protected) and Classes/Meals/Travel/Admin (fixed) offer no concession control.

### The Before → Tradeoffs → After receipt

Source: `scope.md > The Unique Kernel`.

- On save, a receipt is produced with three parts:
  - **Before** — the baseline blocks and hours. This is the clear Before view of the week; once a decision is saved, the top ribbon switches to the After week, so the receipt is where Before is preserved.
  - **Tradeoffs** — the new commitment and each displaced block, named, with hours conceded ("Side project: 10 h → 2 h"). Free Time concessions are listed here exactly like any other named concession — a candidate covered entirely out of Free Time still shows "Free Time: 4 h → 2 h" (or similar), never an empty or implied Tradeoffs section.
  - **After** — the resulting week, including the new commitment and remaining Free Time. The new commitment is labeled **"new commitment"** and treated as **fixed** for the single active decision: it cannot itself be conceded, and the After section labels it plainly.
- The receipt must **reconcile numerically**: every Before → After difference is accounted for by a named tradeoff, and both sides total 168 h. No hour appears or vanishes unexplained.
- The receipt makes **no causal claims** — no "this will cost you sleep quality" or outcome predictions (`scope.md > Explicitly Cut`). Transparent accounting only.

- [ ] For the reference scenario, the receipt reads: new commitment Weekend hackathon 12 h; Free Time 4 h → 0 h; Side project 10 h → 2 h; Before total 168 h; After total 168 h — and every other block is unchanged.
- [ ] A 2 h candidate covered by an explicit "Free Time −2 h" concession produces a receipt whose Tradeoffs section names Free Time (4 h → 2 h); the new commitment appears in After labeled "new commitment".

### One active decision — edit, undo, persistence

Source: `scope.md > The POC Boundary`, `scope.md > The Core Loop`.

- **One active decision at a time** in v1. A saved decision (commitment + concessions + receipt) persists in **localStorage** along with the baseline, across refreshes.
- **Undo** discards the active decision and restores the plain baseline week (and the ribbon returns to showing the baseline). **Edit** reopens the composer/concessions with the current values. Both **recompute from the baseline** — concessions never stack or compound onto an already-conceded week.
- **Baseline protection:** if the user tries to change the baseline while a decision is saved, the change is refused until they **undo the decision first**. This keeps the receipt's "Before" honest.
- **Stale or malformed storage** (unparseable data, wrong shape, values that violate the rules above) must not crash the page. The sample week loads **in memory** with a clear warning that the saved data could not be read, and the corrupt saved data is **left untouched** — it is overwritten only when the user clicks an explicit **"Use sample and replace saved data"** action.

- [ ] Save a decision, refresh the page: baseline, decision, and receipt are all still present, and the ribbon shows the After week.
- [ ] Undo after refresh restores the exact original baseline (Side project 10 h, Free Time 4 h) with no residual concession.
- [ ] Edit a saved decision, change a concession, re-save: the receipt recomputes from the original baseline, not from the previous After.
- [ ] With corrupt data in localStorage, the page loads the sample week in memory with a warning and does not overwrite the corrupt saved data; only clicking "Use sample and replace saved data" replaces it.

### Accessibility of controls

Source: `scope.md > What "Working" Looks Like`.

- Every control is operable by **click and keyboard** — number steppers or inputs plus explicit confirm. Focus states are visible.
- **Drag-and-drop is not required** and is not promised in v1.

## States and Boundaries

- **First use** — the synthetic sample week loads automatically; no empty setup screen blocks the core loop.
- **Composing / conceding** — candidate entered; its full hours still to allocate; save blocked; concession controls live; the readout counting down from the candidate's hours.
- **Reconciled (save available)** — named concessions total exactly the candidate's hours; save enabled.
- **Saved** — receipt displayed with its clear Before view; the top ribbon shows the After week; baseline locked against edits until undo.
- **Empty name error** — composer or baseline block name empty: inline error, nothing saved.
- **Invalid hours error** — baseline block hours negative, NaN/infinite, or non-0.5-increment; candidate hours zero, negative, NaN/infinite, or non-0.5-increment: inline error identifying the field.
- **Protected/fixed concession attempt** — rejected with an explanation that the block cannot give way.
- **Insufficient concessions** — readout shows "still to allocate: X h"; save blocked.
- **Excess concessions** — readout shows the overage; save blocked (total must stay exactly 168).
- **Stale/malformed storage** — sample week loads in memory, warning displayed, corrupt saved data preserved until the explicit "Use sample and replace saved data" action; no crash.
- **Persistence** — baseline + one active decision survive refresh in localStorage; everything is local, nothing is uploaded (`scope.md > The POC Boundary`).

## Product Decisions

All decisions below were made by **Codex, the user's delegated product owner/supervisor**, and supplied for this document — they are not answers from a live learner interview, and none should be attributed to the learner personally.

- **One responsive page, four zones** (ribbon/baseline → composer → concessions → receipt) — the whole decision fits in one scroll; the confrontation with the allocation should not hide behind navigation.
- **Calm editorial ledger look** (warm paper, near-black/navy text, coral warning accent, spacious typography) — the product is honest accounting; it should look like a ledger, and deliberately not like a generic AI dashboard.
- **The sample week is fixed and synthetic** (the exact nine blocks above) — a concrete, reproducible demo baseline that sums to 168 with only 4 h free, so the 12 h candidate forces real concessions.
- **Every new-commitment hour requires an explicit named concession — Free Time is never silently absorbed** — the kernel is named displacement for every hour of every new commitment. Free Time is one named flexible block among others, chosen explicitly like any other; a candidate that would "fit" in Free Time still requires an explicit "Free Time −X h" entry, and the receipt shows it. Silent absorption would hide exactly the trade-off the product exists to surface.
- **Protected blocks can never be conceded; fixed blocks cannot be conceded in v1** — protected is the hard floor the product exists to defend; restricting fixed blocks keeps v1 small while preserving the kernel.
- **Exact reconciliation required** — concessions must total exactly the candidate's hours; excess concessions block save just as insufficient ones do, because the week is a closed 168 h system.
- **Free Time is derived, not entered** (custom baseline) — guarantees the sum is always 168 by construction.
- **0.5 h increments, finite hours; non-negative for baseline blocks, positive for candidates** — fine enough to be useful, coarse enough to keep arithmetic honest; a zero-hour candidate is not a decision.
- **One active decision, undo/edit recompute from baseline** — no compounding, no double-counting; the baseline stays the single source of truth.
- **Baseline edits require undoing the active decision first** — a saved receipt's "Before" must stay true.
- **The ribbon shows the After week once a decision is saved** — the top of the page reflects the week as it now stands; the receipt carries the clear Before view. (Codex review, 2026-10-04.)
- **Malformed storage is never silently overwritten** — the sample week loads in memory with a warning, and corrupt saved data is replaced only by the explicit "Use sample and replace saved data" action. Destroying the user's data to recover from a parse error is worse than showing a warning. (Codex review, 2026-10-04.)
- **The saved commitment is labeled "new commitment" and treated as fixed** — within the single active decision it cannot be conceded, and the receipt's After section labels it plainly. (Codex review, 2026-10-04.)
- **No drag-and-drop** — steppers/inputs plus confirm are fully click/keyboard accessible; drag adds risk without proving anything.

## What We're Building

Everything in Features and Behavior above: the 168 h ribbon and named baseline (sample + custom with validation and derived Free Time), the commitment composer (positive 0.5 h-increment hours), named per-block concessions totaling exactly the candidate's hours — Free Time explicitly included, never silently absorbed — with a live "still to allocate" readout and exact-reconciliation save gate, protected/fixed exclusion from concessions, the reconciling Before → Tradeoffs → After receipt (new commitment labeled and fixed; Tradeoffs always names every conceded block), one active decision with non-compounding undo/edit, ribbon showing the After week while saved, baseline lock while a decision is saved, localStorage persistence with non-destructive malformed-storage recovery, the listed error states, and full click/keyboard accessibility.

## Deferred From the POC

Carried from `scope.md > Later` and `scope.md > Explicitly Cut`:

- **History of multiple past decisions** — v1 holds one active decision; a decision log is later.
- **Conceding fixed blocks** — only flexible blocks give way in v1.
- **Drag-and-drop hour movement** — polish, not mechanic.
- **Deployment** — local acceptance by Codex in a real browser comes first; public repo, demo video, and submission follow.

## Possible Later Enhancements

- Real calendar integration to import actual commitments.
- A history/log of past decisions and their receipts.
- Reminders tied to decision moments.
- Richer visual polish for the ribbon and hour movement.

## Non-Goals

From `scope.md > Explicitly Cut`, plus build temptations:

- **No accounts, cloud sync, or schedule upload** — privacy by construction; localStorage only.
- **No health, sleep, or academic outcome predictions** — unverifiable causal claims; the receipt does accounting only.
- **No AI features inside the product** — AI is the build tool, not the product; the label adds no differentiation.
- **No reminders/notifications** — the product is the decision moment, not ongoing nudging.
- **No real calendar sync in v1** — the synthetic baseline proves the kernel.
- **No multi-decision history in v1** — one active decision keeps undo/edit honest.
- **No silent or automatic allocation of hours** — the product never moves hours on the user's behalf; every displaced hour is an explicit, named user choice (Codex review, 2026-10-04).

## Resolved Questions

The four questions left open in the first draft were resolved by **Codex, the delegated product owner**, in its 2026-10-04 review of this document. They are recorded here with their resolutions; nothing remains open that blocks `4-spec`.

1. **Ribbon display while a decision is saved** — *Resolved:* the top ribbon shows the **After** week once a decision is saved; the receipt carries the clear **Before** view.
2. **Fits-within-Free-Time save** — *Resolved (superseded):* there is no silent-absorption path. Every candidate of N h starts with N h still to allocate and Save blocked; the user must explicitly enter named concessions totaling exactly N, and Free Time is simply one of the named flexible blocks. A 2 h candidate with 4 h of Free Time still requires an explicit "Free Time −2 h", which the receipt then shows.
3. **Stale/malformed storage recovery** — *Resolved:* the sample week loads in memory with a warning; the corrupt saved data is **not** overwritten until the user clicks an explicit "Use sample and replace saved data" action.
4. **The new commitment's classification after save** — *Resolved:* it is labeled **"new commitment"** in the receipt and treated as **fixed** for the single active decision.
