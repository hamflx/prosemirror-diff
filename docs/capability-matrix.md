# Capability laboratory

Build the static laboratory with `npx vite build --config example/vite.showcase.config.mjs` and preview it with `npx vite preview --config example/vite.showcase.config.mjs`. The output is `example/dist/showcase`; `index.html` is the entry. Inputs stay in the browser. No account, analytics or document upload service is required.

| Capability | Layer | Interactive entry | Contract / evidence |
| --- | --- | --- | --- |
| Paired original blocks and synchronized scrolling | Example consumer | Aligned review: insertion, deletion, height and long-table presets | `aligned-review.test.js`; complete gaps, no internal cell identity inference |
| In-block Unicode text highlights | Example consumer over grapheme diff | Aligned review: Unicode preset, Review text, Previous/Next | Original UTF-16 ranges, string Worker cancellation; atoms or incompatible markup stay whole blocks |
| Attribute exclusions | Public structured APIs | Attribute filter, `id`, mixed align/href change | `attribute-filter.test.js`; direct node/mark keys, originals retained, filtered result is not a raw reconstruction patch |
| Text detail and nested structure | `compareDocumentBlocks` plus consumer | Blocks entry | Shared matrix budget, bounded depth, explicit fallback; no move or stable identity claim |
| Same-text marks and node attributes | `compareDocumentMetadata`, `compareNodeMetadata` | Metadata entry | Detached before/after records, both source positions; identical text/structure required |
| Mixed text and formatting | Consumer | Blocks and table entries; offline example | Text correspondence and independent source-format inventories are different evidence, not inferred mark edits |
| Tables and local JSON | Fixed-schema consumer | Tables entry | Model validation and grid validation are separate; legal table/tbody/tr/td rendering; row/column/span changes can remain block-only |
| Error recovery and cancellation | Browser consumers | Invalid JSON, Cancel, repeat selection | Old worker results invalidated; complete originals retained on refinement failure |
| Raw data and offline reports | Example helper / CLI | Offline and integration entry | Runnable helper, event paths, retained parent events and raw JSON; no patch/accept/reject engine |
| Annotation noise policy | Example helper | Linked executable annotation example | Only successful metadata-only comparisons classified; raw records retained, unavailable is conservative |
| Legacy mixed-document comparison | Public legacy API | Legacy migration entry | Validates schema/marks; unrepresentable output throws RangeError; attribute-filter option rejected |
| Package formats and types | Distribution interface | Integration guide | CJS, ESM, UMD builds and TypeScript fixtures; repository additions are not all in npm 0.0.8 |
| Compatibility and performance | Validation evidence | README and evolution records | Pinned compatibility fixtures and reproducible baselines, no universal latency or speedup claim |

## Navigation and lifecycle

The site has three primary routes: `#home`, `#docs` and `#examples/aligned`.
All seven examples mount in the same document; there are no embedded frames or
second-page links required to use an example. Example links are stable hash
routes (`aligned`, `attributes`, `blocks`, `metadata`, `tables`, `legacy`,
`integration`) and work on refresh and browser back/forward navigation.
Switching examples disposes active Workers and alignment observers before the
next example mounts. The original standalone example HTML files remain useful
for focused development and use the same mount functions.

Demo styles are scoped to their surface, and each mounted instance resolves
controls within its own root. Static markup templates are bundled source files;
user JSON is never interpreted as HTML. This keeps the site shell separate from
comparison logic without duplicating the consumers or retaining hidden frames.

## Architecture review

After each coherent feature group, inspect module boundaries, API consistency, repeated logic, dependency changes, test structure and documentation. Record concrete debt and its impact before choosing a small refactor. Re-run relevant regression and browser acceptance after changes. Do not broaden schema, matching or performance guarantees as a substitute for evidence.

The laboratory composes existing consumers rather than copying their comparison logic. Core comparison, consumer policy, browser rendering and deployment remain distinct layers. Custom schemas need their own validation and renderer. Browser layout acceptance is additional to model and DOM tests.
