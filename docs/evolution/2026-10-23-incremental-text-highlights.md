# Incremental source text highlights

Baseline renderer: `ce3da52f1fb6efd35f111b3051c338502fdebaae`.
Integrated master: `0ec07211a18166b245e37f4432d0a746866043c4` by normal merge.
Candidate runtime measured: `5af0d874c27c62f7005cdda980a06e537f15576f`.

## Reproduced cost and scope

The [marked text example](2026-10-23-marked-text-review.md) preserves source marks
but originally recreated every source run for each highlight and restoration.
A fixed 6,000 UTF-16 input with 6,000 alternating strong/em runs exposed the cost
of selecting one character even though only one highlight fragment was needed.
The combined two-side size fits the 20,000 input limit. Pagination limits detail
rows, not source marks or DOM. This is a synthetic stress case, not a claim about
user frequency, market demand or typical documents.

The example now caches original source DOM by source element and exact input Node
identity. Highlighting replaces only intersecting text leaves; undo restores the
original Text objects and keeps mark wrappers. An empty point at a run boundary
is outside marks. For a point inside a marked run, only that run's wrappers split
temporarily around a direct-child marker, then the original wrapper is restored.
Full input changes, cleared/replaced source, reordered runs and relocated temporary
decorations invalidate reuse and trigger reconstruction rather than stale undo.

This changes no public library API, worker protocol or eligibility contract.
Formatting, source Unicode, literal link descriptions and informational-only
text correspondence remain unchanged. Cache validation and finding affected runs
still scan the run list: this is reduced DOM reconstruction, not an O(affected)
algorithm claim. Initial dense rendering, large selected ranges, many mark
attribute rows and complete controller selection costs remain separate concerns.

## Regression acceptance

A 600-run DOM test asserts all original wrappers survive a one-character highlight,
only one Text leaf is replaced, restoration returns the original Text objects,
and an already-restored source produces no child-list mutation. It uses node
identity and mutation counts rather than a wall-clock performance assertion.
Additional tests cover internal empty link markers outside wrappers, input identity
changes, externally replaced source, reordered runs and a moved highlight that
would otherwise cause an invalid undo insertion. Existing per-UTF16 mark/attrs,
grapheme, worker stale/cancel/cache, pagination and unsupported-input suites remain.
The browser benchmark uses 6,000 runs independently of this smaller CI fixture.

## Browser measurement

Both production bundles use the same button-driven local harness, preconstructed
inputs and actual renderer, one side only. Each scenario collects a retained first
warmup and three samples. Initial source preparation, counts and source assertions
are outside the method timing. `performance.now()` encloses the synchronous renderer
call, including allocations and any interruption or GC during it. No library
comparison, worker or controller is inside this method measurement.

Baseline Chrome 155 small-highlight samples: plain 0.50 / 0.30 / 0.20 ms, median
0.30 ms; dense 260.30 / 96.40 / 87.50 ms, median 96.40 ms. Dense warmup 2470.90 ms
is retained. Counts are respectively 1 element / 3 text nodes / 1 fragment and
6001 elements / 6000 text nodes / 1 fragment. Every source text check passed.
Candidate dense small-highlight samples: 2.40 / 2.00 / 2.30 ms, median 2.30 ms;
warmup 5.40 ms. The same 6001 elements / 6000 text nodes / 1 fragment and source
text checks passed. This is an observed reduction in this local synchronous method,
not a whole-interaction guarantee. Candidate restore after a half-text highlight
measured 35.70 / 33.60 / 34.00 ms, median 34.00 ms; warmup 47.10 ms. Restoration
left 6000 elements / 6000 text nodes / zero fragments and preserved source text.
There is no matching browser restore baseline, so no restore speedup is claimed.
All measured samples and warmups are retained, including baseline outliers.

The harness's rAF callback timestamp minus method start can be negative because
frame timestamps can precede the call. Approximate one-second frame spacing was
also observed without an established cause. These fields are retained but excluded
from conclusions; they are not latency, physical paint or INP measurements.
LongTasks use a broader overlap window that includes other work and later rendering;
whole task durations are not attributed to this renderer. The page configures no
CPU throttling but cannot observe external configuration. Visible start/end
snapshots do not prove uninterrupted foreground scheduling. Three samples do not
establish a distribution, p95 or general performance guarantee.

## Validation

- Full suite after integrating master: 264 tests / 23 files passed.
- Complete source checkJs with TypeScript 5.9.3: passed.
- UMD/CJS/ESM library builds and CJS/ESM metadata export smoke: passed; the existing
  ESM module-type detection warning remains unchanged.
- Metadata and block example production builds: passed.
- Checked-in benchmark production build: passed.
- `git diff --check`: passed.
- Actual Chrome production interactions: mixed marks Next via Enter selected
  detail 2 at `[16,17)`; Previous returned to detail 1 with source text intact.
  Cross-mark `[1,3)` graphemes retained separate base/accent fragments on both
  sides. Formatted empty text showed one old `[1,1)` marker and new `[1,5)` range.
  Unsupported inline atoms cleared highlights with an explicit reason. Link
  source contained no anchors. No console warnings/errors were observed. These
  are specific observed interactions, not exhaustive browser coverage.

## Reproduce the renderer measurement

The checked-in `bench/marked-source.html`, `bench/marked-source.js` and
`bench/marked-source.vite.mjs` retain the measured operations and timing logic.
The revision label is manually recorded; update it explicitly for another checkout.
Build with `node node_modules/vite/bin/vite.js build --config bench/marked-source.vite.mjs`,
then serve with `node node_modules/vite/bin/vite.js preview --config bench/marked-source.vite.mjs`.
Open `/bench/marked-source.html`; choose `6000-runs` and small highlight, then
click Run. The page retains a warmup and three samples in its raw observations.
Build output stays under ignored `logs/marked-source-dist`. Initial render,
large-range highlight, restore and attributes are separate operations; do not
compare unlike operations or treat unmeasured scenarios as validated.

Validation commands: `node node_modules/vitest/vitest.mjs run`;
`npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`;
`node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`;
`node test/smoke-metadata-exports.mjs`;
`node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`;
`node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`.
