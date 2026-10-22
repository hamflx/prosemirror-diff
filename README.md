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

## Development

### Read-only metadata review example

From the repository root, run `npm ci` then `npm run demo:metadata` and open
`http://127.0.0.1:5173/metadata.html`. Use `npm run build:metadata-demo` to build
the static example into `example/dist/metadata` (serve that directory over HTTP).
The Vite development tools require Node 20.19+ or 22.12+.

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
