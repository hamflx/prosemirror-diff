# Nested block review consumer

The existing block review example now consumes optional nested details without
changing the library API or dependencies. Default depth zero preserves the
top-level workflow. Depth one and two expose parent/child information with
hierarchical numbering and pre-order keyboard-accessible navigation.

## Range rendering contract

Both documents remain independent fixed-schema renderings. Each container has
its own ordered sequence of boundary markers and child blocks. Render targets
are indexed by absolute range and parent scope, so selecting a child cannot
highlight its entire ancestor or an unrelated sibling. Empty counterpart
ranges use a marker inside the corresponding container. Complete parent
events remain selectable; child information is not an additional edit to apply.

Root fallback is reported separately from recursively counted local fallback
and depth truncation. Each eligible event also displays its local status.
Truncated empty details never mean equality. Repeated children use the API's
deterministic correspondence and are not described as moves or stable identity.

## Reproducible acceptance

Run `npm run demo:blocks` and open `/blocks.html`.

- Changed child: depth 0 has one parent; depth 1 adds item 1.1. Its ranges are
  old `[7,12)` and new `[7,16)`; unchanged siblings and ancestors stay unselected.
- Depth limits: depth 1 reports one truncated descendant; depth 2 exposes the
  grandchild at old `[2,7)` and new `[2,11)` while preserving both parents.
- Empty container insertion/deletion: depth 1 selects the empty position 1
  inside the container, with the opposite empty paragraph visible.
- Strict container: heading and paragraph remain separate one-child originals.
- Repeated child blocks: deletion and insertion navigation preserves sibling
  order and exposes the final boundary at position 10 inside the old container.
- Shared budget: depth 1, 20 cells gives one local fallback despite no root
  fallback; 24 cells removes that fallback. Zero cells remains root coarse.
- Changing to unchanged clears all selections, markers and navigation.

The DOM suite loads the actual HTML/entry module and asserts these scenarios,
including sibling order and scoped markers. It stubs scrolling; jsdom is not
browser layout or keyboard acceptance. Browser evidence is recorded separately.

Validation on the initial integration base: 162 tests passed across 12 files,
including seven new nested-consumer tests. Full source checkJs, UMD/CJS/ESM
builds, a nested CJS export smoke check, both demo production builds and
`git diff --check` passed.

The candidate was then integrated by ordinary merge with master
`3428dcd608bcd39613197549a968cf6037bc48d0`, retaining the caller-selected node
metadata API and its documentation. On that integrated tree, all 181 tests
across 13 files passed. Full source checkJs, all three library formats, both
production demo builds and diff whitespace checks passed again. The CJS smoke
check confirmed nested block output plus both metadata comparison exports.
No browser UI or fixture code changed during this integration.

Real Chrome development-entry checks confirmed depth-one truncation, depth-two
Enter/Space navigation to the grandchild with only its exact range selected,
the nested insertion marker inside its container, and the 20/24-cell precision
transition. At a 390-by-844 viewport the document width equalled its scroll
width (375 pixels), and both selected grandchild ranges remained in view.
Switching to identical documents cleared selections and markers. No console
warnings or errors were observed in those checks. This is targeted browser
acceptance, separate from the automated DOM suite.

The production build was also served and checked in Chrome. Strict-container
depth-one navigation selected the heading/paragraph ranges `[1,13)` within
scope zero. Repeated-child navigation located the new-side deletion marker at
1 beside the first child, then the old-side insertion marker at 10 beside the
last child. Nested deletion selected old `[1,3)` and the new container's empty
range `[1,1)`. The 20-cell shared-budget scenario displayed root success and
one nested fallback. No console warnings or errors were observed in these
production checks.

## Scope and performance

No new runtime dependencies, library behavior or arbitrary-schema rendering are
introduced. Rendering indexes every fixture block and displayed change once;
navigation scans those targets to update selection. The sample is small and
does not claim a large-document UI performance budget or speedup. API matrix
budgets remain precision controls, not wall-clock bounds. Inline comparison,
move recognition and accept/reject remain outside this example's contract.
