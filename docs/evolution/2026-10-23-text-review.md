# Selected-block grapheme review

Base: `80efe3f0ed6349f5b69ade4741e2a131118f722b`.

## Decision and contract

The block review example previously located only whole textblocks. Existing
`diffGraphemes` already preserves original Unicode and supplies sufficient
segments for an example consumer to derive UTF-16 ranges. This batch therefore
adds an example-only adapter, not a new public API or a node-pairing policy.

Only a selected one-to-one replacement of non-atom textblocks with identical
markup and exclusively unmarked text children is eligible. Empty textblocks
are valid. Text marks, inline atoms, hard breaks, different markup, containers
and multi-node gaps remain block events with an explicit explanation. Merely
using `textContent` would erase mark-only and inline-atom differences; fixtures
demonstrate both rejected cases while rendering their original content.

Old and new cursors advance by segment string length in UTF-16 code units.
Unchanged segments advance both cursors; insertion/deletion advances only its
own side. Adjacent changed segments form one detail range. Absolute coordinates
start at each selected event's own `from + 1`, including nested events whose
two starts differ. Source text is neither normalized nor rendered as HTML.

The original block list and its navigation remain complete. A separate panel
provides text-detail navigation within the selected block. Empty text ranges
have inline markers, with accessible position labels outside the source text
content. Parent events and text details are information, not separate edits to
apply. Changing the selected event or comparison removes stale text highlights.

## Work and precision limits

Only the selected eligible event is compared, and its result is cached for the
current block-comparison result. The example rejects inputs above 20,000
combined UTF-16 positions. This is a product limit, not a wall-clock guarantee.
The existing grapheme function has an independent algorithm budget per call;
segmentation, validation and rendering do not have a whole-call deadline.

The grapheme function may return a coarse replacement but does not expose
fallback status. The UI always states this limitation and never infers precision
from a `grapheme` label or the block result's fallback flag. `maxCells` controls
block alignment only. No minimum-edit, identity or speedup claim is made.

## Reproduction and validation

Run `npm run demo:blocks`, open `/blocks.html`, and select:

- Unicode text: a family emoji remains whole; combining `e` plus accent stays
  two UTF-16 positions while precomposed `é` stays one.
- Empty text insertion/deletion: an inline point at position 1 locates the
  empty paragraph text, opposite the four-position flag.
- Text boundaries: three insertion details at old positions 1, 2 and 3 retain
  exact source text and sibling order.
- Nested text: depth 1, then select the child event. The shifted-nested fixture
  has emoji ranges old `[16,27)` and new `[24,35)` after a preceding sibling
  changed length; each coordinate comes from its own original document.
- Marked text and inline tokens: original content stays visible, and the text
  panel explicitly refuses refinement rather than reporting no changes.

Helper tests cover reconstruction, Unicode positions, empty boundaries,
unsupported inputs, text-size limits and forced time/edit-budget fallback.
Actual-entry DOM tests cover navigation, scoped ranges, source preservation,
state cleanup, lazy calculation/caching and literal HTML-like text. DOM tests
stub scrolling and are not browser layout or keyboard acceptance.

Validation: all 199 tests across 15 files passed, including eight helper tests
and seven text-review DOM tests. Full source checkJs, UMD/CJS/ESM library
builds, metadata and block demo production builds, and `git diff --check`
passed. A CJS smoke check confirmed `diffGraphemes`, `compareDocumentBlocks`,
`compareDocumentMetadata` and `compareNodeMetadata` exports and the four-unit
flag insertion. No library source or dependency was changed.

After an ordinary merge with master
`dee8b74f6eaf8e52814e394851bcd135d2158515`, the full suite passed again:
203 tests across 16 files, including the independently added metadata-boundary
regressions. UI and fixture code did not change during this integration.
Full source checkJs, all library formats, both production demos and the
post-build `node test/smoke-metadata-exports.mjs` check passed on the integrated
tree. That smoke verifies CJS and ESM metadata results and rejection contracts.

Targeted Chrome acceptance on the development entry confirmed whole-family
emoji highlights, preserved combining characters, visible empty-text markers
without source-text contamination, and shifted nested ranges `[16,27)` versus
`[24,35)`. Marked text and inline tokens remained visible while refinement was
refused and previous text highlights were cleared.

On the production build, family emoji remained one highlighted segment.
Keyboard Enter navigation reached the third boundary detail, old `[3,3)` and
new `[5,6)`, while source strings remained `AB` and `xAyBz`. At 390 by 844,
client and scroll widths were both 375 pixels, with a visibly sized inline
marker. No console warnings or errors were observed in these production checks.
These are targeted browser checks, not a claim of exhaustive browser coverage.

## Helper measurement

Command: `node bench/text-review.mjs`. Each input's string repetition and node
construction happen before timing. Each case receives one warmup and seven
measured calls; timing includes helper eligibility checks, text extraction,
segmentation, comparison and range allocation, but excludes module loading,
DOM rendering and navigation. These are observations, not a deadline or
before/after performance comparison. Runtime: Node 24.19.0.

| Case | Old/new UTF-16 length | Detail ranges | Median ms | Min–max ms |
| --- | --- | --- | --- | --- |
| Short Unicode | 18 / 17 | 2 | 0.133 | 0.063–0.208 |
| One edit in 10k text | 10,000 / 10,000 | 1 | 2.313 | 1.815–3.307 |
| High edit distance | 5,015 / 4,014 | 1 | 323.804 | 310.052–360.533 |

The high-distance case illustrates why lazy comparison and a size limit matter:
it can still take hundreds of milliseconds. The result does not report whether
fallback was used. Broader text review or arbitrary inputs would require separate
responsiveness and cancellation design; this fixed-fixture example makes no
such support claim.
