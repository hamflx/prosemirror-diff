# Shared example layout and navigation

The showcase has Home, Documentation and Examples routes. Example links use
`#examples/blocks`, `metadata`, `tables`, `legacy`, `aligned`, `attributes` and
`integration`. They mount within the same document, without embedded browsing
contexts. Changing routes disposes the previous consumer and its Workers.
Standalone development pages remain available and restore after cached navigation.
Local table JSON drafts are cleared when leaving that example or reloading.

## Unchanged content must line up

The structural example previously rendered the two originals independently. In
the empty-paragraph insertion fixture the short insertion boundary was followed
immediately by an unchanged image, while the other side first rendered the taller
empty paragraph. The unchanged image therefore started at different vertical
positions. Synchronizing scroll offsets alone cannot correct that layout.

The block, metadata and table consumers now share a presentation layout. Exact
content matches anchor vertical spacing while original nodes, raw reports and
ProseMirror ranges remain unchanged. Nested exact matches are included when a
single compatible container pair permits refinement. Correspondence remains
deterministic content alignment, not persistent identity or move detection.

The presentation pass has its own fixed 100,000-cell matrix budget and maximum
depth 32. It is separate from the report's selected budget/depth and is not a
whole-call time guarantee. Table anchors are computed in the existing Worker.
This extra comparison is a maintenance cost; reuse of report anchors should be
considered only while preserving the report's explicit precision contract.

Space in tables is introduced by sizing existing rows, never by inserting rows
or cells that could change rowspan semantics. Original grid structure and span
attributes remain intact. The fixed-schema renderer is not an arbitrary-schema
layout engine. Different content and coarse/unpaired regions are not claimed to
have exact correspondence.

Both panes reserve scrollbar space so adding alignment space does not change text wrapping. Both panes scroll together. Layout is recomputed for width/content changes and
asynchronous review updates. Controllers disconnect observers, release detached
nodes and remove scroll handlers when replaced. Comparison columns stay beside
each other at narrow breakpoints; input and detail controls may wrap independently.

## Regression scenarios

- Insert a paragraph and an empty paragraph before unchanged following content.
- Nested unchanged children around edited or inserted siblings.
- Repeated identical blocks with deterministic correspondence and original offsets.
- Row insertion and an unchanged following row, including a preceding spanning cell.
- Different caption heights, asynchronous changed-block growth and repeated switches.
- Hash deep links, browser history, skip-to-content and cached-page restoration.

Geometry assertions in DOM unit tests use synthetic measurements and do not
replace browser bounding-box checks. Real browser acceptance compares screen y
coordinates of corresponding original content and checks both scroll directions.
