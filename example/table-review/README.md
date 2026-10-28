# Read-only table review

From the repository root run:

```sh
npm ci
npm run demo:tables
```

Open **`/tables.html` on the local address printed by Vite**, for example
`http://127.0.0.1:5173/tables.html`. Use the printed port if 5173 is occupied.
The root `/` belongs to the older Vue example and is not this demo's entry.
The table example does not require installing the separate Vue example package.

For a production preview run:

```sh
npm run build:tables-demo
npm exec -- vite preview --config example/vite.tables.config.mjs --host 127.0.0.1
```

Again open **`/tables.html` on the preview address**, usually
`http://127.0.0.1:4173/tables.html`. Alternatively serve `example/dist/tables`
over HTTP and open its `tables.html`; do not use a `file://` URL for the Worker.
The
`prosemirror-tables` dependency is development-only; the library API and its
production dependency range are unchanged.

This fixed-schema example reuses the [official-table consumer](../table-snapshots/README.md)
and its model, grid and resource preflight. It renders both originals separately,
then lists the existing parent and nested block events. Selecting an event shows
both original half-open ranges and locates original elements. Row/cell spans
remain valid HTML: `table > tbody > tr > td/th`; no diff divs are inserted there.
An empty boundary is stated numerically outside the table, with a containing table
highlighted only for context. No synthetic empty row/cell is created.

## Compare your own JSON pair

Open **Compare your local JSON snapshots**, paste the before/after document JSON,
then press **Compare JSON**. The initial drafts contain the row-insertion example.
The selected source changes to **Local JSON inputs**; changing the alignment
budget recomputes the current pair. Choosing a bundled example preserves drafts.
Editing either draft cancels pending work and clears all old output immediately.
Results retain canonical original snapshots and original ranges, not JSON source
whitespace/key ordering. Parse/schema/grid failures show no stale result.

JSON parsing and comparison run in the local Worker. No input upload, storage,
network request or navigation is added; link attributes stay literal data. Each
side allows at most 256 KiB UTF-8 and the pair at most 2,000 document nodes, before
existing schema/grid limits. Textarea length is an additional character cap; the
Worker checks actual UTF-8 size. These bounds are not a time guarantee. Inputs
stay in the current page until edited/reloaded; this is not a sandbox for hostile
JavaScript objects, an HTML importer or a general-schema adapter.

## Scope and conservative behavior

- Only the bundled schema is accepted, including locally pasted JSON pairs; this
  is not a renderer for arbitrary similar-looking schemas.
- Unknown nodes/marks/attrs, nested tables, invalid spans/grids and consumer limits
  reject the comparison. Failure clears old documents, events and raw output.
- Text and marks remain in the original cells. The event list does not separately
  classify formatting. Parent/child events are not additive patches or proof of
  identity, and column/row changes are not semantic move detection.
- Marks on non-text nodes cannot be represented by this renderer and reject the
  view, rather than being silently dropped or wrapped around table structure.
- The zero-cell mode deliberately permits coarser results. It is not a same-quality
  speed comparison. Whole originals remain visible when refinement is unavailable.
- Column width arrays remain in raw data and DOM data attributes; pixel-identical
  editor column sizing is outside this example. Link marks are literal spans with
  their attributes in raw output, not navigating anchors.
- Comparison runs in a dedicated Worker. Each scenario/budget switch terminates
  the old worker, clears the view and rejects obsolete callbacks. There is no
  whole-call timing guarantee, background persistence or accept/reject workflow.
- All events/raw output are retained. This small example does not claim scalable
  virtualization for large event lists or a complete accessibility certification.

## Reproducible samples and acceptance

`samples.json` contains ten pairs: row/column insertion and deletion, horizontal
and vertical merges, restoration of each original layout, marks-only and mixed
text/marks. The baseline is a 2x2 A/B/C/D table between Before/After paragraphs,
so table coordinates are nonzero. Merge snapshots were generated with official
`mergeCells`; restoration pairs reverse those snapshots, not a `splitCell` command.
The page additionally exercises equality and a deliberately invalid grid.

`test/table-review-dom.test.js` verifies the ten pairs against the official schema
and grid checks, exact raw block reconstruction, unchanged input, original element
positions, HTML nesting, cancellation, stale callbacks, errors and recovery.
Production-browser acceptance additionally requires actual Worker completion,
event selection/scroll, keyboard focus at navigation edges, repeated scenario and
budget switching, invalid-grid recovery, and 390/650px layouts. DOM tests alone
cannot establish those browser results.

## Demand and alternatives

[Tiptap #6203](https://github.com/ueberdosis/tiptap/issues/6203), opened 2025-03-25
for the older Snapshot Compare 2.17.5, reports table wrappers disrupting merged
cell layout. Multiple comments include a documentation-table use case; a CSS
`display:contents` workaround does not by itself establish valid HTML semantics.
This motivates keeping original grids intact, not claiming that every current
alternative is broken. [Current Tiptap Compare](https://tiptap.dev/docs/compare/getting-started/overview)
is already headless and supports client/server use; this example claims neither
exclusive architecture nor competitive parity.

Browser entry checks must include their Worker modules explicitly: TypeScript
does not follow a Worker `new URL(...)` as an imported source. The block and table
entries use DOM element types matching their respective HTML controls.
