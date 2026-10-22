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

## Development

```sh
npm ci
npm test
npm run build
```
