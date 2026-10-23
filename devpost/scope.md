---
doc: scope
status: approved
---

<!-- Drafted 2026-10-03. The substantive answers below come from the delegated
     product brief (`../forge/idea.md`, written by Codex as the user's authorized
     supervisor) and `devpost/learner-profile.md` — not from a live interview
     with the learner. Codex reviewed and approved this scope on 2026-10-04. -->

# GiveWay

One line: a time trade-off tool for the moment *before* you accept a new commitment — you can't add hours to an already full week until you explicitly choose which existing hours give way, and you walk away with a receipt of what you gave up.

## The Unique Kernel

Calendars and auto-schedulers answer "where does this fit?" GiveWay asks "where do these hours come from?" The week is a fixed 168-hour budget made of **named, existing commitments/blocks** — e.g. "Side project", "Study", "Rest" — each with an hour count and a classification: **fixed**, **flexible**, or **protected**. A named **Free Time** block holds whatever is left, so all blocks sum to exactly 168. A new commitment that would overflow the total **cannot be saved** until the user concedes hours from flexible blocks — and a reduction must name **exactly which existing block gives way** ("Side project: 10 h → 6 h"). Reducing an aggregate category without naming the displaced block is not allowed, because the product's force comes from confronting the specific thing being set down. Protected blocks (e.g. a sleep floor) cannot be silently cut. Saving produces a **Before → Tradeoffs → After** receipt naming the new commitment, each displaced block with its hours conceded, and the remaining margin. The displaced hours are explicit, never absorbed invisibly.

## Who It's For

A person juggling courses, work, family, and personal projects at the exact moment someone invites them to take on something new — a project, a club role, another competition — and they haven't answered yet. The concrete first case: an engineering undergraduate carrying coursework plus multiple concurrent hackathons. Today they say yes on gut feel and discover the cost later, in lost sleep. (Demo data is synthetic; no real private schedule is used.)

## The Core Loop

Open the app, see the week's baseline: among other named blocks, "Study 30 h, fixed", "Side project 10 h, flexible", "Rest 14 h, protected", and "Free Time 4 h, flexible", with the running total at 168. Type in a candidate commitment ("weekend hackathon, 12 h/week"). It exceeds the 4 h of free time, and save is blocked until the user explicitly chooses 12 h of concessions. They can select "Free Time −4 h" and "Side project −8 h"; each reduction names its source block, and the "still short by X hours" readout updates live until the gap hits zero. Save, and get the receipt. Come back next time an invitation arrives; the baseline and the current decision persist across refreshes, and the decision can be edited or undone without double-counting.

## Inspiration & Identity

Deliberately *not* AI-wrapped: the user rejected the previous idea because AI tool use is baseline among all entrants in this hackathon. The value lives in the interaction itself — explicit trade-offs and clear, honest visuals — not in a model label. The app does transparent time accounting only. Specific look-and-feel direction was not volunteered; `3-prd` will fill that gap in 1–2 questions under `prd.md > Look and Feel`.

## Why This Matters to the Learner

The learner is living the trigger scenario right now — university courses plus several hackathons in parallel — so "should I say yes to this?" is a real, recurring decision for them, not a hypothetical user story.

## What "Working" Looks Like

A small end-to-end browser proof of concept (Codex's chosen shape), demonstrable in about a minute: from an empty state, build or load a sample week whose named blocks sum correctly to 168 hours (including the Free Time block); attempt to add a 12 h commitment when only 4 h is free and watch the save stay blocked with the 12 h concession requirement visible; explicitly concede "Free Time −4 h" and "Side project −8 h" while "Rest" stays untouched because it is protected; save and read the receipt, whose before, per-block concessions, and after numbers all reconcile; refresh the page and find the baseline and decision still there. Interaction is click/keyboard-accessible throughout — number steppers or inputs plus confirm — with any visual movement of hours treated as presentation polish, not the core mechanic; drag-and-drop is not promised unless a later PRD explicitly opts for it. The memorable beat: committing "one more hackathon" into a full week, discovering there are no hidden 12 hours, and reading a receipt that says plainly "to say yes to this, I set down these things."

## The POC Boundary

In: browser-local single-page app; no accounts; localStorage persistence; synthetic sample week plus a build-your-own baseline; named blocks with hours and fixed/flexible/protected classification, summing to 168 with an explicit Free Time block; overflow detection with save blocking; per-block concessions that name their source block and are capped at that block's hours; protected blocks excluded from concessions; the Before → Tradeoffs → After receipt; **one active decision/scenario saved in v1**, with edit/undo that recomputes from the baseline so nothing double-counts (a history of multiple past decisions is deferred); correct handling of bad input (no negatives, no NaN). Everything is verifiable by an agent operating a normal desktop browser.

## Later

Real calendar integration, reminders, history of many past decisions beyond the current baseline, deployment, richer visualization polish.

## Explicitly Cut

- **Real calendar sync** — out of scope for a 2–4 hour proof of concept; synthetic baseline proves the kernel without it.
- **Reminders / notifications** — the product is about the decision moment, not ongoing nudging.
- **Health or academic outcome predictions** ("2 h less sleep costs you X") — unverifiable causal claims; the app does transparent accounting only.
- **Accounts, cloud sync, any upload of schedules** — privacy by construction; localStorage is sufficient for the PoC.
- **AI features inside the product** — AI is the build tool here, not the product; an AI label adds no differentiation in this hackathon.
- **Deployment in v1** — public repo, demo video, and submission wait until after Codex's local browser acceptance.

## Novelty — Candid Limitation

K2.7's 2026-10-03 primary-source prior-art check found three adjacent tools, none confirmed to combine a hard save gate on overflow with a named-displacement receipt:

- **TaskBerry** (https://taskberry.app) — capacity-based weekly planning with overflow warnings, but overflow is flagged rather than blocking, and trade-offs are not recorded as named displacements.
- **Sunsama** (https://www.sunsama.com) — daily planning with deferral of tasks that don't fit, but deferral postpones work instead of forcing an explicit concession from a named block at save time.
- **Day Optimizer** (https://www.dayoptimizer.com) — commitment budgeting with manual trade-off decisions, but no confirmed hard save gate tied to per-block displacement receipts.

No claim of global originality is made: this check covered primary sources for these named competitors and may have missed others. What we can say: the explicit-displacement mechanic — blocking the save until hours are conceded from specifically named blocks, with protected blocks exempt and a reconciling receipt — is not documented behavior in any of the three tools above, and it is the thing a reviewer should remember.
