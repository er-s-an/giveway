# GiveWay

A time trade-off tool for the moment *before* you accept a new commitment. The week is a fixed 168-hour budget of named blocks; a new commitment cannot be saved until you explicitly choose which existing hours give way, and saving produces a Before → Tradeoffs → After receipt of what you set down.

When one answer isn't obvious, **"Compare two ways to say yes"** opens an optional side-by-side comparison: Plan A is your current draft, Plan B starts as an editable copy. Both plans are checked against the same untouched week — never against each other — and each shows exactly what it trades (named sources Before → After, Free Time, what stays put, 168 h totals on both sides). Only the plan you choose is saved; the other stays a draft, and leaving the comparison keeps your original draft untouched.

No framework, no build step, no dependencies, no accounts — one HTML page, one stylesheet, three small ES-module JavaScript files.

## Run it

From this directory (the project root, the one containing `index.html`):

```
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open **http://127.0.0.1:4173/** in a browser.

(Serving from the project root over HTTP is required so the ES-module imports resolve; `file://` will not load modules.)

## Run the tests

Pure-model tests, zero dependencies, two ways:

- **Node:** `node tests/model.test.js`
- **Browser:** with the server above running, open **http://127.0.0.1:4173/tests/tests.html**

## Layout

```
index.html      the single page: five zones
styles.css      ledger look: warm paper, navy text, coral warning accent
src/model.js    pure time model — ticks, validation, Free Time, save gate, receipt
src/storage.js  versioned localStorage persistence with a malformed-data write guard
src/app.js      DOM controller — renders zones, hours↔ticks at the UI boundary
tests/          zero-dependency pure-model + storage test harness
```

The baseline and the one active decision persist across refreshes under the `giveway:v1` key. If the saved data is ever unreadable, the sample week loads in memory with a warning and nothing is written over it until you click **"Use sample and replace saved data"**.

## Build provenance and license

The required Devpost Learn Skill Pack planning artifacts are in `devpost/scope.md`, `devpost/prd.md`, and `devpost/spec.md`. `skills-lock.json` records the six upstream Skill Pack paths and hashes. The Skill Pack itself is available from [challengepost/learn-ai-basics](https://github.com/challengepost/learn-ai-basics); its instruction files are not redistributed in this package.

GiveWay's included first-party source and documentation are provided under the MIT License in `LICENSE`.
