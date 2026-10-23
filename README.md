# prosemirror-diff

Compare two ProseMirror documents and mark inserted and deleted content.

## Diff levels

Character-level diffing remains the default:

```js
const result = diffEditor(schema, oldDoc, newDoc)
```

Word-level diffing first aligns Unicode words, whitespace, and punctuation. Paired replacements are then refined by grapheme so small edits such as `JSON5` to `JSON6` only mark the changed characters. Standalone word or block insertions and deletions retain `level: 'word'`.

```js
const result = diffEditor(schema, oldDoc, newDoc, {level: 'word'})
```

For fine-grained Unicode edits without word alignment, opt into grapheme mode:

```js
const result = diffEditor(schema, oldDoc, newDoc, {level: 'grapheme'})
```

This treats an extended grapheme cluster as one unit: changing `😉` to `😀`,
`👍🏻` to `👍🏿`, or `é` to `è` marks the complete changed cluster, without
highlighting half a surrogate pair or a detached accent. Word mode already uses
grapheme refinement inside replacements; this mode aligns graphemes directly
across the whole text run. It uses the bundled segmenter, without Intl word
segmentation, and preserves the exact input without Unicode normalization.

The text-only helper is also available without a ProseMirror schema:

```js
import {diffGraphemes} from '@hamflx/prosemirror-diff'
diffGraphemes('cat', 'cart')
// [{type: 0, text: 'ca', level: 'grapheme'},
//  {type: 1, text: 'r', level: 'grapheme'},
//  {type: 0, text: 't', level: 'grapheme'}]
```

The `diffMark` schema must declare both attributes if consumers need the level metadata:

```js
diffMark: {
  attrs: {
    type: {default: 0},
    level: {default: 'char'}
  }
}
```

`level` accepts `'char'`, `'word'`, or `'grapheme'` in `diffEditor`,
`patchDocumentNode`, and `patchTextNodes`. Existing schemas that declare only
`type` remain compatible, but ProseMirror will omit the undeclared `level`
attribute. Consumers that validate level values must allow `'grapheme'` before
opting in. The default remains the legacy UTF-16 character algorithm.

## Guarantees

- Calling `diffEditor` without options retains character-level comparison for valid outputs. Inputs or mixed results that violate content/mark constraints now throw instead of returning invalid nodes.
- Word tokenization preserves every source character and uses `Intl.Segmenter` when available, with a Unicode-aware fallback. Grapheme refinement uses a bundled UAX #29 segmenter in every environment.
- Word/grapheme search budgets can degrade large, dissimilar inputs to coarser replacements while preserving text. They are not whole-call deadlines: segmentation, validation, output construction and legacy character mode have no total-time guarantee.
- Word diff segments can always reconstruct both inputs by excluding insertions for the old text and deletions for the new text.
- `diffGraphemes` has the same reconstruction property, and segment boundaries
  follow the bundled segmenter's extended grapheme boundaries on each input.
  Its edit-distance/time budget falls back to coarser complete-grapheme
  replacements. This bounds diff search, not total time or allocation for
  arbitrarily large input; segmentation is still proportional to input size.
- Grapheme mode preserves existing formatting boundaries. If an input already
  splits a grapheme across differently marked text nodes, the output can retain
  that split even though its diff segments cover complete graphemes. Structural
  nodes and inline leaves retain the existing document-diff limitations.

## Compare formatting and attributes without a mixed document

### A caller-selected node pair

`compareNodeMetadata(oldNode, newNode, {oldFrom = 0, newFrom = 0} = {})`
compares metadata within an explicitly selected pair, even when unrelated parts
of the surrounding documents contain text edits. The caller is responsible for
the correspondence: this API does not infer identity or pair multi-node gaps.

```js
import {compareNodeMetadata} from '@hamflx/prosemirror-diff'

const changes = compareNodeMetadata(oldParagraph, newParagraph, {
  oldFrom: oldParagraphPosition,
  newFrom: newParagraphPosition
})
```

Each offset is the node's **outer start** in its own document, defaulting
independently to zero for node-local coordinates. Node attrs/marks span
`[from, from + node.nodeSize)`; child content begins at `from + 1`.
Offsets and range ends must be non-negative safe integers, otherwise `RangeError`
is thrown. The caller supplies the containing-document coordinates; the function
cannot verify that the node actually occupies that position in a document.

Pass valid non-text, non-document Nodes from the same schema instance and of the
same type. Paragraphs, strict containers and image leaves are supported without
constructing a temporary document. Exact text and non-text structure must match;
formatting-induced text splits may differ. A text/type/structure mismatch throws
`RangeError`. Direct text nodes are rejected with `TypeError` (compare their
parent); document roots are rejected with `TypeError` (use the document API
below). Different schema instances and non-node inputs also throw `TypeError`.

Records, traversal order, UTF-16 indexing and detached metadata snapshots follow
the document API below, but the two sides may have different absolute positions.
Snapshot handling has the same plain-data contract; it is not an isolation
boundary for malicious JavaScript objects. Inputs are schema-checked and never
modified. Text edits within the selected pair still reject the whole comparison;
this is not a patch or general structural comparison API.

### Whole-document metadata revisions

`compareDocumentMetadata(oldDoc, newDoc)` reports **metadata-only revisions**
as detached data. Pass valid ProseMirror document Nodes from the same schema
instance; JSON snapshots can be loaded with `Node.fromJSON(schema, json)`.
It needs no editor, DOM, or `diffMark` definition and does not change either
document or the behavior of `diffEditor`.

```js
import {Node} from 'prosemirror-model'
import {compareDocumentMetadata} from '@hamflx/prosemirror-diff'

const changes = compareDocumentMetadata(
  Node.fromJSON(schema, oldJSON),
  Node.fromJSON(schema, newJSON)
)
// A bold mark added to the first paragraph's "abc":
// [{kind: 'marks', nodeType: 'text',
//   oldFrom: 1, oldTo: 4, newFrom: 1, newTo: 4,
//   before: [], after: [{type: 'strong'}]}]
```

Records have `kind: 'attrs' | 'marks'`, `nodeType`, half-open `oldFrom`/`oldTo`
and `newFrom`/`newTo`, and detached `before`/`after` snapshots. Attr records
contain the entire attribute object; mark records contain arrays of mark JSON
(including link attributes). Image/leaf attributes, block attributes and
document attributes are included. Traversal order is parent before children,
attrs before marks at a node, and text order within a run.

Positions use ProseMirror's UTF-16 indexing. Non-text nodes span their full
node size; document-root metadata spans `[0, doc.content.size)`, which can be
empty. Text mark ranges follow the union of old/new formatting boundaries,
so differently split text nodes are supported without heuristic alignment.
Ranges can overlap (for example, paragraph attrs and a child's marks).
The two sides' ranges are equal for this restricted metadata-only contract;
they are explicit to let consumers address both original documents.

**Scope:** node types/order and exact text must match after joining adjacent
text nodes. Text edits, insertions/deletions, or changed non-text structure
throw `RangeError`, rather than returning a partial comparison. The API pairs
repeated blocks by position; identical-content blocks with swapped metadata
are reported as metadata edits, not detected moves. This is not a full
structural diff, position mapping, patch, or accept/reject engine. Both inputs
are schema-checked. Different schema instances, non-document inputs, or cyclic
or non-plain metadata throw `TypeError` (invalid schema content fails validation).
Snapshots support plain objects, arrays, strings, booleans, finite numbers,
null and undefined; they do not invoke custom serializers.

Consumers can use the records in side-by-side views or change lists while
keeping strict schemas intact. These APIs do not alter the legacy renderer's
alignment; its schema-validation boundary rejects unrepresentable mixed output.

## Top-level block changes

`compareDocumentBlocks(oldDoc, newDoc, {maxCells: 100000})` returns
`{changes, fallback}` for valid document Nodes from the same schema instance,
with identical document-level type, attrs and marks and only block children.
Root markup differences and top-level inline children throw `RangeError`;
use `compareDocumentMetadata` for root metadata-only revisions.

Each change has `kind: 'insert' | 'delete' | 'replace'`, `oldFrom`, `oldTo`,
`newFrom`, `newTo`, `before: Node[]` and `after: Node[]`. Positions are half-open
ProseMirror UTF-16 ranges in the two original document contents. An insertion
has an empty old range; a deletion has an empty new range. Arrays are new, but
their nodes are shared immutable ProseMirror values: do not mutate nodes or attrs.
This differs from the detached metadata snapshots returned by the metadata API.

```js
const {changes, fallback} = compareDocumentBlocks(oldDoc, newDoc)
for (const change of changes) {
  console.log(change.kind, change.oldFrom, change.newFrom)
  // Render change.before and change.after separately with your own schema renderer.
}
```

Equal prefix/suffix blocks are retained first. In the remaining middle, exact
`Node.eq` matches anchor a longest common subsequence (including text, attrs and
marks). Ties consume the old block first. Unmatched runs become one replacement,
insertion or deletion. Repeated equal blocks have deterministic correspondence,
not proven identity; reordering is represented by deletion/insertion, never moves.
Nested edits are whole top-level block replacements, not fine-grained nested diffs.
No mixed document is created, so strict single-child containers stay intact.

`maxCells` is an integer from 0 to 1,000,000 (default 100,000), bounding the LCS
matrix cells, including its empty row/column. If the middle needs more cells,
one coarse middle change is returned with `fallback: true`. If trimming the equal
prefix/suffix leaves one side empty, the remaining insert/delete needs no matrix
and has `fallback: false`, including with a zero budget. Multiple insertions
interleaved with unchanged blocks may still need a matrix or use fallback.
The budget does not bound total time: schema validation, large-subtree equality,
prefix/suffix scanning and result construction still cost time. This is a block
range query, not an editor transaction, position-mapping or accept/reject engine.

### Optional nested block details

Pass `maxDepth` (an integer from 0 through 32, default 0) to add informational
details inside eligible replacement events. Default output is unchanged and
contains no `details` fields. The complete parent replacement always remains.

```js
const result = compareDocumentBlocks(oldDoc, newDoc, {maxDepth: 2, maxCells: 100000})
// A replacement may have details: {changes, fallback, truncated}.
// Render parent and child information hierarchically; do not apply both as edits.
```

Only a one-node-to-one-node replacement with identical `sameMarkup`, non-atom
containers, and block-only direct children is eligible. Different types, attrs
or marks, inline content, atoms and multi-node gaps remain whole-block events.
This is a deterministic content correspondence, not proof of shared identity.
Child ranges use absolute positions in the original documents, including each
container opening token. Nodes continue to be shared immutable values.

Depth 1 compares the children of top-level eligible replacements; depth 2 can
compare their eligible child containers, and so on. At the depth limit, an
otherwise eligible event has `details: {changes: [], fallback: false,
truncated: true}`. Its empty details do not mean that the contents are equal.

All levels share the **one** `maxCells` allocation budget, debited root first,
then depth-first in event order. If a layer exceeds the remaining budget, it
returns a coarse change with `fallback: true` and does not refine that layer.
The full parent event still carries its original before/after nodes. `fallback`
and `truncated` describe only their own layer, not the entire subtree; inspect
descendant `details` recursively for deeper fallback/truncation. A parent layer
can therefore have both flags false while a descendant is truncated. The
top-level `fallback` keeps its previous meaning. Budget and depth are precision
controls, not a whole-call deadline or protection against arbitrarily deep input.

## Development commands

### Read-only block review example

From the repository root, run `npm ci`, then `npm run demo:blocks` and open
`http://127.0.0.1:5173/blocks.html` (use the port printed by Vite if occupied).
`npm run build:blocks-demo` builds `example/dist/blocks` for local HTTP serving.

This consumer of `compareDocumentBlocks` keeps both originals separate. Select
changes or use Previous/Next to locate changed blocks on both sides. An empty
counterpart range has a visible insertion/deletion point, including position
zero in an empty document. Block labels expose exact half-open ranges.

Detail depth defaults to 0, retaining the top-level list. Select 1 or 2 to
inspect child blocks or grandchildren. Parent events remain in the hierarchical
list; Previous/Next follows its displayed order. Selecting a child highlights
only its absolute range within the correct container, including empty ranges.
These are informational details: do not apply both parent and child as edits.

Nested fixtures cover strict containers, repeated children, empty containers
and depth limits. The shared-budget fixture uses 20 cells to demonstrate a
local fallback in the second sibling while root alignment succeeds; 24 cells
allows both child comparisons. The summary counts descendant fallback and
depth limits, with per-layer explanations in the list. Empty truncated details
do not imply equal contents. No fallback means the matrix budget sufficed,
not proof of node identity or a finest-grained text comparison.

Fixtures cover paragraphs, empty blocks, image attributes, a strict single-child
container and repeated blocks. The budget example switches between default
alignment and zero cells; a coarse fallback is explicitly labelled and can
include unchanged blocks. Pure one-sided insertions may need no matrix even
with zero cells. This fixed-schema renderer is not arbitrary-document support,
move detection, nested inline diffing, or an accept/reject editor. The existing
metadata and legacy Vue editor examples retain their separate entries/builds.

The selected-block text panel adapts the existing `diffGraphemes` output inside
this example, without adding a public API. A single non-atom textblock
replacement with matching markup and text-only children can be refined, including
strong, em, code and link marks supported by the fixed example schema. Original
formatting is preserved independently on each side; text correspondence does not
independently compare formatting or establish historical character identity.
Links are non-navigation spans with visible href/title snapshots. Unknown marks,
unsupported mark attributes and non-text inline nodes are explicitly rejected. Its separate text navigation highlights original UTF-16 ranges, including
inline markers for empty ranges; complete block events remain selectable.
Nested old/new offsets are calculated independently. Source Unicode is not
normalized, and parent/text details must not be applied as separate edits.

Only the selected block is compared, with cached results until the comparison
changes. A combined 20,000 UTF-16-position limit bounds this example's input;
it is not a time, DOM-size or mark-count guarantee. The grapheme algorithm can return coarse replacements
without exposing fallback status, so these are not guaranteed minimal edits.
The block alignment cell budget does not control text comparison. Use the
Unicode, empty-text, shifted-nested and unsupported-input fixtures to inspect
these boundaries. Marked, cross-mark grapheme and formatting-only fixtures are
described in the [marked text review record](docs/evolution/2026-10-23-marked-text-review.md).
Same-text formatting differences still use metadata comparison; zero text hunks
do not mean unchanged formatting. `node bench/text-review.mjs` measures the example helper on
three preconstructed inputs; it does not measure DOM rendering or claim a speedup.

The browser example checks eligibility and size on the main thread, then sends
only text strings and offsets to a module worker. Selecting another event or
reloading the comparison terminates pending work; stale responses cannot change
the current selection. Completed cached results do not start another worker.
While calculating, old text details clear and the panel shows a pending state.
If workers are unavailable or fail, complete block navigation remains usable;
there is no synchronous calculation fallback. Serve the built example over HTTP
and retain the emitted worker asset. Worker calculation does not bound DOM
rendering costs for many detail rows or guarantee whole-page responsiveness.
The synchronous helper benchmark remains a computation reference, not browser
response-time evidence. See the [browser measurement record](docs/evolution/2026-10-23-text-responsiveness.md).

The text-detail list renders at most 50 rows per page while retaining every
returned hunk. Previous/Next text detail crosses pages; Previous/Next text page
selects the first detail of the destination page. The panel reports the selected
global detail, visible range, total and page count. Changing the selected block,
including returning to a cached result, resets to the first page and detail.
The **Review many separated text edits** fixture contains 600 separated changes,
but the algorithm may return fewer, coarser hunks under its deadline; the UI always
reports the actual result. Source documents and complete parent events remain
intact. See the [pagination investigation](docs/evolution/2026-10-23-text-pagination.md)
for the isolated DOM-scale experiment and its measurement limits.

Text selection reuses original source formatting DOM and decorates only intersecting
text leaves. Restoring a selection restores the original nodes. Empty points remain
outside marks; an internal point splits only its containing run temporarily. Cache
validation and range lookup still scan the original runs, and initial rendering,
large highlights and visible attribute descriptions can remain expensive. See the
[incremental highlight investigation](docs/evolution/2026-10-23-incremental-text-highlights.md).

### Read-only metadata review example

The **Caller-selected paragraph** fixture retains two complete documents with
different introduction and closing text. Only the explicitly selected middle
paragraph is passed to `compareNodeMetadata`; its strong/link records use different
absolute positions on the two sides. The scope banner and list heading state that
other edits are not compared and the pair is chosen explicitly, not matched
automatically. Existing whole-document fixtures still use
`compareDocumentMetadata`, including the rejected text-edit recovery example.

From the repository root, run `npm ci` then `npm run demo:metadata` and open
`http://127.0.0.1:5173/metadata.html`. Use `npm run build:metadata-demo` to build
the static example into `example/dist/metadata` (serve that directory over HTTP).
Vite and the jsdom integration tests require Node 20.19+, 22.12+ or 24+.

`npm test` includes the actual example HTML/entry module in jsdom and tests
navigation, exact highlights, rejected/empty-state cleanup and recovery. jsdom
does not perform layout or scrolling; these tests stub only `scrollIntoView`
and do not replace browser visual/keyboard testing. Demo links cancel ordinary
clicks; their retained URLs can still be opened with browser context menus or
middle-button navigation.

The example uses this checkout's source API and fixed fixtures for bold, link
targets and image attributes. Select a change, or use Previous/Next, to highlight
its exact range in both read-only documents. It also demonstrates an empty
result and rejection of a text edit. It does not accept arbitrary input, map
structural edits, or implement accept/reject. Its renderer only supports its
small fixture schema. The existing Vue editor example remains separate.

```sh
npm ci
npm test
npm run build
```

See [composition counterexamples and schema boundaries](docs/evolution/2026-10-23-composition-contracts.md) before combining block, metadata and plain-text results. The record includes reproducible legacy renderer limitations for exclusive marks and mark-disallowing nodes.

Legacy mixed-document APIs validate content and mark sets at their public boundaries. An unrepresentable mixed result now throws `RangeError` with its validation cause instead of returning an invalid node; valid outputs keep their comparison behavior. This does not validate arbitrary attrs or make all schemas representable. See [legacy schema validation](docs/evolution/2026-10-23-legacy-schema-validation.md) for helper scope, compatibility and external-result alternatives.
