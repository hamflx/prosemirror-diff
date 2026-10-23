# Informational nested block details

Original implementation base: `a1fb36a176b4dddda787edef0e86971e80172511`.
Integrated and revalidated against `c0f9958a7f94b84e5c0277be88e3ba89b8db8ae0`,
including the block review example.

## Motivation and scope

The [custom-node discussion](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328)
describes the noise of replacing a whole complex block for a small internal
change. Participants later report successful per-node/LCS approaches, so this
does not establish an entirely unsolved problem. The [strict-container example](https://discuss.prosemirror.net/t/suggestions-as-decorations/9027)
also motivates keeping original documents valid rather than mixing old/new nodes.

The current block query reports a quote containing three paragraphs as one whole
replacement. This batch adds opt-in informational detail while retaining that
complete parent. [Tiptap Compare](https://tiptap.dev/docs/compare/api-reference/types)
already exposes nested change types, and its [suggestion utilities](https://tiptap.dev/docs/compare/api-reference/utilities)
describe nested information under parent suggestions. Our narrower API makes no
uniqueness claim and implements no accept/reject or editor transaction behavior.

## Contract and ambiguity

`maxDepth` is an integer 0..32, default 0. Default results have no details fields;
the existing top-level contract, tie-breaks, root requirements and fallback
meaning remain unchanged. Eligible one-node-to-one-node replacements may carry
`details: {changes, fallback, truncated}`. Eligibility requires sameMarkup,
non-atom containers and block-only direct children. Different node types, attrs,
marks, inline content and multi-node gaps remain coarse. Matching content is
not proof of identity; this adds neither stable-ID pairing nor move detection.

Every child position is absolute in its original document. Descending adds the
container opening token. For a quote with `a`, `old`, `b` becoming `a`, `updated`,
`b`, the retained parent spans old `[0,13)`, new `[0,17)`, while its detail spans
old `[4,9)`, new `[4,13)`. A strict container's heading-to-paragraph replacement
has child `[1,8)` on both sides and is not further paired across different types.

One matrix allocation budget is shared by the whole invocation: root first,
then depth-first in event order. Each successful matrix subtracts all its cells,
including empty row/column. An oversized layer returns a coarse change and stops
refining that layer. It does not erase parent content. Input validation, equality,
prefix/suffix scanning and output are not bounded by the matrix budget.

Depth 1 compares children of eligible top-level replacements. At the configured
depth, a deeper eligible event has empty details with `truncated: true`. This
does not mean its contents are equal. Both `fallback` and `truncated` are local
to their layer, not summaries of descendants; consumers must recursively inspect
details. Parent and child events overlap intentionally and must not both be
applied as edits. Returned Nodes remain shared immutable ProseMirror values.

## Validation

155 tests pass after integration: 138 previous and 17 new. New coverage includes default shape,
absolute nested coordinates, strict containers, inserted/deleted empty blocks,
repeat-block tie breaking, ineligible markup/atom/inline/multi-node cases, root
and sibling budget sharing, exact budget edges, and explicit depth truncation.
One seeded 100-pair test checks parent reconstruction, child slice equality and
containment, and source preservation at three budgets; it is one test, not 100.
An additional compatibility experiment compared 1,500 default-mode results with
the base implementation at three budgets; all were identical.

Source checkJs, UMD/CJS/ESM builds, CJS nested export smoke, existing metadata
and block demo production builds and `git diff --check` pass. No dependencies added.

Commands: `npm test`, `npm run build`, `npm run build:metadata-demo`, `npm run build:blocks-demo`,
`npm exec --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`,
`node test/benchmark-nested-blocks.mjs`.

## Informational performance baseline

Inputs are preconstructed: a quote inside a quote contains N paragraphs, every
tenth changed. Three warmups and 15 complete timed calls include schema validation,
alignment and result construction. Event count includes retained parent events.
Median / sample p95 in milliseconds:

| Paragraphs | Depth / cells | Events | Fallback layers / truncated layers | Median / p95 |
| --- | --- | --- | --- | --- |
| 100 | 0 / 100000 | 1 | 0 / 0 | 0.058 / 1.189 |
| 100 | 1 / 100000 | 2 | 0 / 1 | 0.047 / 0.976 |
| 100 | 2 / 100000 | 12 | 0 / 0 | 0.718 / 1.302 |
| 100 | 2 / 8 | 3 | 1 / 0 | 0.051 / 0.286 |
| 1000 | 2 / 100000 | 3 | 1 / 0 | 0.292 / 0.858 |

These modes expose different detail; the figures are not speedup claims. The
1000-paragraph case intentionally falls back rather than computing exact inner
LCS. Next work is a hierarchical consumer showing parent/detail scopes and local
truncation/fallback clearly before considering broader pairing heuristics.
