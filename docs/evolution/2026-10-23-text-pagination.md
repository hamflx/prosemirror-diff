# Paginated text-detail list

Base: `b356d426aa3d59fd4be10a44e9bb91ebb4f8ace4`.

## Evidence and decision

The worker-backed example removed fresh text calculation from the main thread,
while a prepaired single-block cache return still rendered every text-detail row.
An isolated production-build experiment compared 600 rendered rows with only the
first 50 rendered rows. Both retained all 600 computed hunks, the same initial
selection (index 0) and exactly equal original source strings (2,890 UTF-16
positions on each side). The 50-row experiment was deliberately incomplete UI,
not a deliverable feature or a changed result contract.

After one cache-establishing run per variant, five alternating cached samples per
variant were collected with visible documents, ready results, actual controller
reuse and no worker events. Both variants used identical coarse synchronous-stage
timing instrumentation. Observed milliseconds:

| Measurement | Full 600-row list | First-50-row experiment |
| --- | --- | --- |
| Cached controller select | 27.7, 27.0, 23.7, 27.7, 26.5 | 1.6, 1.7, 1.7, 2.0, 1.6 |
| List construction stage | 19.6, 19.2, 16.6, 19.7, 18.0 | 0.6, 0.6, 0.6, 0.6, 0.6 |
| Observed overlapping Long Tasks | 74, 65, 60, 64, 63 | None in these five windows |

This supports bounding list DOM size for this fixture. It does not attribute all
long-task duration to list construction, establish general performance or prove
absence of future long tasks. Several animation-frame observations had roughly
1-2 second outliers; all were retained, their cause remains unknown, and frame
measurements are not used to claim responsiveness improvement. These are
instrumented experiment results, not performance claims for the finished paginated
UI, not INP, and not a user-population percentile estimate.

## Delivered example behavior

The controller keeps complete `review.hunks` and a global selected index. Only the
current 50-row page is rendered. Global detail navigation crosses pages, while
separate page buttons select the destination page's first detail. Visible buttons
and ordered-list numbering use global indices; the panel reports visible bounds,
actual total and page count. Existing small lists retain the same selection and
range behavior. Page-local row selection preserves the existing button elements.

Pending, unsupported, failure, disposal and a new selection clear page state.
Returning to a cached block starts at its first detail without recomputation.
Source text, two-sided absolute ranges, inline empty-range markers, complete parent
block events and cancellation safeguards remain unchanged. There are no library
API or dependency changes. A fixed many-edits scenario makes the behavior
inspectable; its algorithm can return a coarser result under the existing deadline,
so the UI uses the actual hunk count rather than promising 600 results.

## Reproducible validation

- `node node_modules/vitest/vitest.mjs run`: 225 tests / 18 files passed (216
  existing, 9 added). Pagination uses controlled legal worker results for stable
  0/1/50/51/600 boundaries, independent of timing-dependent diff coarse fallback.
- Tests traverse all 600 results and check exact selected ranges, unchanged source
  text, at most 50 visible rows and terminal controls. They verify both directions
  at the 50/51 boundary, page-first selection, empty-range markers, focus on the
  persistent navigation control and reset across cached/pending/stale/error/
  unsupported/disposed states. These are actual controller DOM tests in jsdom;
  they do not substitute for real browser keyboard/layout acceptance.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD/CJS/ESM passed.
- `node test/smoke-metadata-exports.mjs`: passed; the existing Node module-type
  detection warning for the ESM bundle remains unchanged.
- `node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`: passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`: passed.
- `git diff --check`: passed.

Real Chrome acceptance of the development example observed 600 returned details
with only 50 list buttons rendered. Keyboard navigation crossed 50 to 51 while
retaining focus on Next text detail, then 51 to 50 and 100 to 101. Page controls
reached the page beginning at 551 and the final detail 600, where both next
controls were disabled. Original source lengths remained 2,890 on each side.
The production build separately passed keyboard navigation from 50 to 51.

A production measurement harness using the same preconstructed single-block
fixture recorded one fresh and five cached samples against the delivered
pagination controller. Every result reported 600 total details with 50 visible.
The fresh result became ready in 211.7 ms, with 178.7 ms worker computation and
3.8 ms result-delivery/controller DOM work. Cached select calls took 1.5-1.6 ms;
no worker events or overlapping Long Tasks were observed in those five windows.
However, all five cached second-animation-frame measurements were approximately
1,991.8-1,995.4 ms. These observations are retained without attributing a cause;
the synchronous cached-call measurements must not be presented as end-to-end
response-time improvement. This small instrumented sample is not a latency
guarantee, and the independent experimental variants above are not the finished UI.

Pagination bounds list rows, not total comparison memory, document rendering,
source-text replacement, layout cost or whole-page response time. No text algorithm
or deadline changed. Follow-up measurements must distinguish cold calculation,
cache return and interactive navigation rather than conflating their costs.
