# Bounded mark-description pages

Base: `1556b1e0c50be15016babfd480d31f1ace74ce6e`.
Integrated master: `74ea6a0987a7c225ba1d01dc23001a6460f68d83` by normal merge.
Migration example code, configuration and tests are retained unchanged. The only
merge conflict was the research index; both completed batches and this candidate
were retained.
Measured candidate renderer: `c9083affa918a1c9e0f5b531f6c9194d9586d597`.

## Evidence and chosen scope

The [incremental text highlight work](2026-10-23-incremental-text-highlights.md)
reduced repeated source decoration. Initial source rendering and visible link
attribute descriptions remain distinct costs. In the same production Chrome 155
renderer harness, 6000 alternating source runs measured 50.90 / 45.30 / 40.60 ms
(median 45.30 ms; warmup 53.00 ms) for initial rendering. The 6000 two-mark fixture
produced 6000 link-description list items: 34.80 / 37.80 / 24.30 ms (median 34.80 ms;
warmup 36.30 ms) for description creation and mounting. All source checks passed.
All samples, including warmups, are retained; these are small synthetic observations,
not population statistics or claims about real document frequency.

The harness source is connected. The actual block example builds source and
attribute lists within detached blocks before attaching them. These measurements
are renderer microbenchmarks, not complete scenario loading, layout, paint or INP.
The retained rAF frame timestamp differences can be negative and are not callback
latency. Overlapping LongTasks contain other work; their full durations are not
attributed to this method. The page itself applies no throttling but does not
observe external settings. This evidence supports bounding list DOM and improving
navigation, not claiming whole-page acceleration.

## Behavior

This example-only change retains all original description records with their
absolute source ranges. Up to 50 records still render as a simple unordered list.
Larger lists render at most 50 actual `li` elements with a visible total/current
range/page indicator and native Previous/Next buttons. Every record remains
reachable; different titles on otherwise identical hrefs are not merged.

Each block and document side owns independent state. Accessible group and button
names identify that block and side. The page status is a polite atomic live region.
On reaching a boundary, focus moves to the remaining enabled navigation button
if the previously focused button becomes disabled. Ordinary page changes retain
the same buttons. Reloading the scenario creates fresh first-page state.

Unknown mark records are counted and named in a persistent warning, even when the
current page contains only supported links. Their individual original ranges remain
in the full paged record sequence. Link href/title values remain literal visible
text, including empty titles and null; no executable anchors are created. Original
source DOM and formatting are untouched by description navigation.

Collection still scans all mark runs and stores record references. Only visible
rows are formatted and materialized into DOM. This does not bound source runs,
total records, memory, initial source construction or the full operation's duration.
No library API, worker protocol or dependency changes.

## Reproduce and verify

Use `/blocks.html`, scenario `marked-many-links` (Browse many link descriptions).
Two blocks on each side each contain 102 records, with a long href and unknown mark
on the last page. The existing short link example remains a simple list.

`bench/marked-source.*` keeps the same production harness and method timing. Choose
`6000-two-marks` / `Visible mark descriptions`. The record counter uses
`querySelectorAll('li').length`, so it measures actual visible rows rather than the
pagination container's direct child count. Its revision label is manually recorded.
Candidate Chrome attributes samples: 4.90 / 6.40 / 20.90 ms, median 6.40 ms;
warmup 13.70 ms. All four observations retain the 12000 source elements and
6000 text nodes, preserve source text and show exactly 50 description `li` rows.
Compared with the baseline 6000 rows and 34.80 ms median, this demonstrates the
intended DOM bound and lower observed method median in this fixture. It does not
establish whole-page speed, a distribution or a maximum duration. The 20.90 ms
sample and warmup are retained; no outliers were discarded. Page-switch timing
was not measured by this initial-description operation.
Actual Chrome production interactions: two Enter activations on the first before
block reached records 101-102 of 102 while the other three blocks remained at
1-50. At the last page focus moved to Previous; two Enter activations returned
to the first page and focus moved to Next. No anchors or console warnings/errors
were observed. Narrow-viewport behavior has not been verified in this round.
These observations do not constitute an exhaustive accessibility audit.

Regression tests cover 0/1/50/51 records, all 6000 records across every page, exact
range/title order, unknown marks off-page, terminal-page focus, independent block
and side state, real entry reload and original source-node identity. The large
record test checks completeness and a 50-row DOM bound, not elapsed time.

Validation after integration: 284 tests in 26 files passed; complete source checkJs, UMD/CJS/ESM,
CJS/ESM export smoke, metadata, block and legacy production builds passed. The benchmark build passed
before integration; its renderer and harness were unchanged by the merge.
The existing ESM module-type detection warning remains unchanged.

Commands: `node node_modules/vitest/vitest.mjs run`;
`npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`;
`node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`;
`node test/smoke-metadata-exports.mjs`;
`node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`;
`node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`;
`node node_modules/vite/bin/vite.js build --config bench/marked-source.vite.mjs`;
`node node_modules/vite/bin/vite.js build --config example/vite.legacy.config.mjs`.
