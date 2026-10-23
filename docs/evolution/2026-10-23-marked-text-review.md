# Mark-preserving text review example

Base: `66927c54ef7eb4c0e67338c9fb9868a87bcc1b6e`; integrated master
`f6ee645edfb2971dc0b82c24d24173f7eab31ccb` with a normal merge.

## Motivation and scope

Sources checked on 2026-10-23: the [marks and attrs discussion](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
and [PR 18 composition investigation](https://github.com/hamflx/prosemirror-diff/pull/18)
show why plain text alone cannot describe a formatted replacement. The
[composition record](2026-10-23-composition-contracts.md) separates text,
formatting and node correspondence. Existing alternatives, including
[Tiptap Compare](https://tiptap.dev/docs/compare/api-reference/types), support
formatting changes; this example does not claim a unique capability or market size.

This batch extends only the read-only block example. It retains the complete
parent block event and refines a caller-selected, single non-atom textblock
replacement with identical node markup. All direct children must be text.
The fixed vocabulary is strong, em, code with no attributes, and link with
string href and optional string/null title. Unknown marks, unsupported attributes,
inline atoms and hard breaks explicitly refuse text details. Atom attribute
comparison remains available through the existing metadata API.

Text ranges express grapheme correspondence, not an independent formatting diff,
minimal edits, historical identity or edit provenance. A persistent notice makes
this limitation visible. Identical text with changed marks produces no text
hunks but explicitly reports formatting differences and points to metadata
comparison. Repeated `a` correspondence remains ambiguous. Existing legacy
`diffEditor` schema failures with exclusive marks are not repaired by this batch.

## Presentation and lifecycle

Original mark runs stay on the main thread. The worker still receives only
strings and positions. Source rendering uses Text nodes and fixed DOM tags;
no source HTML or arbitrary schema rendering is executed. Each side retains its
own original marks during highlighting, restoration, cached selection and page
navigation. Graphemes crossing mark boundaries have one logical hunk and multiple
DOM highlight fragments. Empty ranges have a single marker without changing
source text or formatting any additional character.

Links are non-navigation spans. Their href/title snapshots are visible beside
the source, with empty strings distinct from null. Attributes are displayed as
literal text, including HTML-like or JavaScript-like values. Unknown formatting
is visibly identified as uninterpreted rather than silently treated as plain.

The 20,000 combined UTF-16 limit, worker cancellation, stale-response isolation,
error handling, cached results and 50-row detail pages remain. This input limit
is not a mark-count, DOM-size or total-time budget. No marked-content performance
claim is made; previous plain-input timing results cannot establish performance
for dense mark runs, which require separate measurement.

## Reproducible acceptance

Serve `/blocks.html` using the existing example commands in README. Added fixtures:
`marked-mixed`, `marked-grapheme`, `marked-link`, `marked-empty`, `marked-repeat`,
`marked-nested`, `marked-unknown`, and `text-hard-break`. The existing `text-marks`
fixture now demonstrates formatting-only comparison. Nested depth 1 retains
independent text ranges `[13,16)` and `[21,24)`.

The DOM regression oracle walks every UTF-16 unit and compares original mark
names and attributes against actual DOM ancestry. It also verifies strong/em/code
tags and non-navigation link spans, rather than trusting textContent or data
attributes alone. Cases cover overlapping and adjacent marks, code exclusion,
cross-mark graphemes, link literals, a unique insertion marker at a run boundary,
formatting-only revisions, repeated characters, pagination, restoration, cached
selection, stale completion, errors and unsupported inputs. Existing composition
assertions were deliberately updated to accept supported text correspondence
while retaining schema checks, original snapshots and metadata rejection rules.

Validation after integration:

- Full Vitest suite: 246 tests in 21 files passed.
- Source checkJs, UMD/CJS/ESM builds, CJS/ESM export smoke and both example builds:
  passed. The existing ESM module-type detection warning remains unchanged.
- `git diff --check`: passed.
- Actual Chrome development-entry checks: mixed strong/em/code preservation;
  cross-mark grapheme `[1,3)` fragments; formatting-only zero-hunk notice;
  visible old/new link attributes with no source anchor/href and no ordinary or
  middle-click navigation; nested independent ranges; empty flag marker and
  strong formatting; unknown marks, hard breaks and inline atoms rejected with
  cleared detail lists. No console warnings/errors observed in these checks.
- Actual Chrome production-entry checks: nested Next keyboard navigation
  observed child 1.1 then 1.2, preserving code text and independent
  `[13,16)` / `[21,24)` ranges; mixed Next keyboard navigation selected the
  second text hunk `[16,17)` while retaining code `x()` / `y()`. Link spans
  had no href, tabIndex -1, visible per-side attributes and no middle-click
  navigation. The link fixture at 390 x 844 had equal client/scroll widths
  of 375 pixels. No console warnings/errors observed.

These browser checks are specific observed interactions, not automated coverage
of all browsers, accessibility behavior or arbitrary schemas.

Reproduction commands:

```sh
node node_modules/vitest/vitest.mjs run
npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js
node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs
node test/smoke-metadata-exports.mjs
node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs
node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs
git diff --check
```
