# Composition counterexamples and schema boundaries

Base: `66927c54ef7eb4c0e67338c9fb9868a87bcc1b6e`.

## Why these cases matter

The [October 2-4, 2024 marks/attrs discussion](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
asks for side-by-side formatting and attribute changes. Replies explain the scope
of changeset ranges and suggest transform-step information; this is a concrete
use case, not proof that all alternatives remain unsolved.
The [June 10-11, 2026 suggestions discussion](https://discuss.prosemirror.net/t/suggestions-as-decorations/9027)
shows that placing both replaced children inside a single-child container violates
its schema; the discussion considers decorations and the cost of nested editors.
[Tiptap Compare already documents markChange and nested change types](https://tiptap.dev/docs/compare/api-reference/types).
These capabilities are not unique to this library. The examples below are local
contract reproductions, not external bug reports or evidence of usage volume.

## Contracts that must not be silently combined

| Input / intent | Metadata comparison | Example plain-text details | Complete external block result |
| --- | --- | --- | --- |
| Same text, different strong mark | Reports mark change | Rejects marked content | Preserves both original nodes |
| Text and strong mark both change | Rejects changed text | Rejects marked content | Preserves both original nodes |
| Inline leaf attrs change, equal textContent | Reports attrs | Rejects inline leaf | Preserves leaf and attrs |
| Non-leaf inline atom attrs change | Reports attrs with identical structure/text | Rejects atom despite visible descendant text | Preserves atom and contents |
| Inline atom insertion with equal textContent | Rejects structure change | Rejects atom | Preserves the inserted atom |
| Nested plain Unicode text edit | Rejects changed text | Reports grapheme ranges with independent offsets | Preserves full parent and child events |
| Exclusive code mark with text edits | Rejects changed text | Rejects marked content | Retains valid exclusive marks |
| Mark-disallowing plain code block text edit | Rejects changed text | Supports external text ranges | Retains valid unmarked code blocks |

Matching text is not historical identity. In two repeated `same` paragraphs,
position-based formatting records and a caller-selected equal-mark correspondence
can both be internally consistent yet describe different interpretations.
The same ambiguity exists inside one textblock: for `aa` becoming `a`, either old
occurrence could be considered retained. Snapshot text alone does not reveal which
occurrence a user deleted or which historical mark belongs to a retained character.
A string alignment is not a provenance map for marks. Do not apply a metadata pass
across text edits or treat a block replacement as proof of node identity.

`textContent` also cannot establish completeness: a leaf atom can disappear from
that string, whereas a non-leaf atom can expose descendant text without ceasing
to be an atom. The tests distinguish attribute-only atom revisions (already
supported by metadata) from inserted atoms and unsupported text-only refinement.
Parent events remain complete; child/text details are informational, not extra
patches to apply. Grapheme level describes boundaries, not minimality, certainty
or whether the algorithm fell back.

## Executable legacy renderer diagnostic

After building, run `node test/repro-legacy-mark-validation.mjs`. It uses the same
CJS ProseMirror model instance as the library bundle, checks both inputs and reports
whether the output passes `Node.check()`. It deliberately does not assert that an
invalid output is desired, so a future repair can produce successful validation.

On this baseline, all char/word/grapheme modes reproduced these limitations:

- `code` with `excludes: '_'`, `cat` to `cart`: result validation reports
  `Invalid collection of marks for node text: code,diffMark`.
- A `code_block` with `marks: ''`, `a` to `b`: result validation reports invalid
  code-block content containing `diffMark` text.

The legacy renderer appends display marks into schema-constrained content. Merely
adding `diffMark` can conflict with exclusive marks or a parent's mark allowance;
silently dropping source marks would lose meaning. These legacy validation failures remain unfixed. This batch does not change that
public behavior, automatically modify schemas or claim arbitrary-schema legacy
support. Its regression tests instead verify that external block events preserve
valid original nodes, metadata rejects incompatible text edits, and the plain-text
adapter accepts only its supported cases. The diagnostic is outside unit discovery.

## Validation

- `node node_modules/vitest/vitest.mjs run`: 235 tests / 20 files passed (225
  existing, nine composition cases and one cold-runtime initialization case).
- Composition tests use explicit input/output ranges, original node identity,
  unchanged independent JSON snapshots, schema checks and original document slices.
  The repeated-block case checks reconstruction without prescribing an inferred move.
- `test/grapheme-runtime.test.js` removes `Intl.Segmenter` before a fresh dynamic
  import, then checks default word-token fallback and Unicode reconstruction. It
  restores the original global descriptor and module state. This closes the gap
  left by stubbing after module initialization; it is not a full UAX #29 conformance
  claim or coverage of every runtime.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD/CJS/ESM passed.
- `node test/smoke-metadata-exports.mjs`: passed, with the existing ESM module-type
  detection warning unchanged.
- `node test/repro-legacy-mark-validation.mjs`: six valid-input/invalid-output
  observations above; these are known limitation evidence, not six passing tests.
- `node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`: passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`: passed.
- `git diff --check`: passed.

No runtime algorithm, dependency or public API changed, and no performance claim
is made. README timing language is corrected: word/grapheme search budgets can
coarsen results, but segmentation, validation, output construction and legacy
character mode have no whole-call time guarantee. Future rich-text comparison
needs explicit mark correspondence, schema-valid presentation and ambiguity policy;
these counterexamples should be reviewed before that API is proposed.
