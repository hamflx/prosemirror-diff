# Read-only block review consumer

Base: `a1fb36a176b4dddda787edef0e86971e80172511`.

## Motivation and scope

The block query can describe insertions/deletions and strict-container changes,
but its metadata-only example cannot display these results. A consumer must
handle empty opposite-side ranges as well as content ranges and disclose coarse
fallback precision. This bounded workflow precedes speculative nested pairing.
The [strict-container case](https://discuss.prosemirror.net/t/suggestions-as-decorations/9027)
motivates keeping each original document valid instead of mixing inserted and
deleted children. The [custom-node discussion](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328)
includes successful pairing approaches as well as rendering limitations; this
example does not claim to resolve arbitrary custom-node rendering.

The separate `blocks.html` Vite entry consumes this checkout's block API. Nine
fixtures cover paragraph insertion/deletion, empty paragraphs, image attrs,
strict single-child containers, repeated blocks, alignment budgets, an empty
document and identical documents. Block labels expose original document ranges.
An empty range gets a visible insertion/deletion point on the corresponding
side; UI markers are not inserted into either ProseMirror document.

Default and zero-cell controls demonstrate precision differences. Fallback
is explicitly announced and may highlight unchanged blocks inside a coarse
replacement. Repeated blocks are deterministic correspondences, not move or
identity detection. Nested edits replace the containing top-level block. The
renderer supports only the fixture schema, with no editing, persistence or
accept/reject behavior. No library/runtime dependency changes are made.

## Repeatable validation

Four fixture tests assert exact ranges, empty points, strict container validity,
image replacement, repeated-block output and fallback semantics. Six DOM tests
load the actual entry/HTML and exercise range/marker selection, navigation,
budget changes, strict rendering, unchanged-state cleanup and recovery. jsdom
stubs scrolling only; it cannot verify layout, focus or actual image loads.

All 138 tests pass (128 existing plus ten block-example tests). Source checkJs,
UMD/CJS/ESM builds, CJS block/metadata exports and both example production builds
pass. The block build contains approximately 38.69 kB JavaScript (12.88 kB gzip)
and 3.13 kB CSS (1.16 kB gzip), plus two SVG fixtures. These are asset sizes,
not runtime speed measurements.

Run from the repository root:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run build:metadata-demo
npm run build:blocks-demo
npm run demo:blocks
```

Source type audit:
`npm exec --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`.

## Existing metadata example browser revalidation

The existing metadata page was rechecked in Chrome independently of jsdom:
Tab skips the disabled Previous control and reaches Next with a visible focus
outline; Enter selects the exact link ranges on both sides; Space selects images
and disables Next. Both images finish loading. Unsupported input clears all
highlights and list items; unchanged and restored combined scenarios recover
correctly. At a 390 by 844 viewport there is no horizontal overflow. No console
warning/error messages were observed.

That browser check also found an overbroad link tooltip. It now says “ordinary
click disabled”, with a DOM assertion, matching the existing behavior and README.
The href remains available to middle-button/context-menu browser navigation.

## Block example browser acceptance

The development entry was checked separately in Chrome. Paragraph insertion
shows an old-side marker at `[9,9)`; deletion shows the new-side marker at
`[9,9)`. The empty-paragraph fixture remains visible and the empty-document
fixture marks position zero. Strict containers retain one rendered child on
each side, heading versus paragraph.

In the budget fixture, default alignment produces two events; keyboard Enter on
Next selects the second. Zero cells produces one explicitly labelled coarse
event including the unchanged anchor. Images load, and the unchanged fixture
clears selections/navigation. At 390 by 844 the controls and documents stack
without horizontal overflow. No console warning/error messages were observed.

The built production entry was also checked in Chrome: the initial insertion
marker and content are correct, both image assets finish loading, and switching
the budget fixture to zero produces one coarse event spanning three blocks on
each side with the fallback notice. No console warning/error messages were
observed. No runtime benchmark is rerun or speedup claimed: the comparison
implementation is unchanged. The prior block API baseline continues to apply.
