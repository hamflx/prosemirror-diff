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

The `diffMark` schema must declare both attributes if consumers need the level metadata:

```js
diffMark: {
  attrs: {
    type: {default: 0},
    level: {default: 'char'}
  }
}
```

`level` accepts only `'char'` or `'word'`. Existing schemas that declare only `type` remain compatible, but ProseMirror will omit the undeclared `level` attribute.

## Guarantees

- Calling `diffEditor` without options preserves the original character-level behavior.
- Word tokenization preserves every source character and uses `Intl.Segmenter` when available, with a Unicode-aware fallback. Grapheme refinement uses a bundled UAX #29 segmenter in every environment.
- Diff limits degrade large, dissimilar inputs to coarser replacements instead of corrupting text or blocking indefinitely.
- Word diff segments can always reconstruct both inputs by excluding insertions for the old text and deletions for the new text.

## Development

```sh
npm ci
npm test
npm run build
```
