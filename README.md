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

- Calling `diffEditor` without options preserves the original character-level behavior.
- Word tokenization preserves every source character and uses `Intl.Segmenter` when available, with a Unicode-aware fallback. Grapheme refinement uses a bundled UAX #29 segmenter in every environment.
- Diff limits degrade large, dissimilar inputs to coarser replacements instead of corrupting text or blocking indefinitely.
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
keeping strict schemas intact. Existing `diffEditor` output and its structural
limitations are unchanged.

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

Fixtures cover paragraphs, empty blocks, image attributes, a strict single-child
container and repeated blocks. The budget example switches between default
alignment and zero cells; a coarse fallback is explicitly labelled and can
include unchanged blocks. Pure one-sided insertions may need no matrix even
with zero cells. This fixed-schema renderer is not arbitrary-document support,
move detection, nested inline diffing, or an accept/reject editor. The existing
metadata and legacy Vue editor examples retain their separate entries/builds.

### Read-only metadata review example

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
