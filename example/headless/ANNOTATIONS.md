# Annotation-only review classification

Run `node example/headless/annotation-example.mjs` for a complete example with
an explicitly owned comment schema. The raw block replacement remains present,
model equality remains false, and a separate review policy classifies the
metadata records. No CLI defaults or library exports change.

```js
import {reviewAnnotations} from './annotation-policy.mjs'
const review = reviewAnnotations(oldDoc, newDoc, ['comment'])
```

Both inputs must be document roots from the same schema instance. The optional
list defaults to empty: no changes are hidden. Unknown names, duplicates and
non-string names throw TypeError. Names are explicit policy, not automatically
recognized annotations. Existing snapshot CLI schemas continue to reject marks
they do not define; this helper accepts already-created ProseMirror documents.

Only successful whole-document metadata comparison is classified. Its complete
detached `records` remain unchanged. `hiddenRecordIndices` identifies marks
records whose before/after values become equal after excluding the requested
names; `visibleRecordIndices` contains all other records. Node attrs and mixed
nonignored formatting remain visible. Indexes refer to this records array, not
block event paths or edits. A consumer may collapse an `annotation-only` review,
but must retain a label/count and a way to reveal the raw records. The helper
itself deletes nothing and never changes raw block events.

`classification` is `unchanged` only for no metadata records, `annotation-only`
only for nonempty entirely hidden records, and `visible` otherwise. These are
review categories, not replacements for Node.eq or a reconstruction contract.
Original UTF-16 ranges are retained, including mark boundaries inside graphemes.
JSON-loaded nodes use the caller's same schema and normalized model semantics.

Text/structure differences, validation/snapshot failures, or admission overflow
return `coverage: 'unavailable'`, no records, and empty index arrays. This means
**keep the raw comparison visible**, not no changes. The helper does not identify
hidden comments inside mixed text edits. It does not infer moves, identity,
patches, author history, or ignored nodes.

Admission is at most 20,000 model nodes and 100,000 UTF-16 text units combined
across both roots (inclusive). This bounds admitted model size, not attribute
bytes, recursion depth, memory, or elapsed time. Metadata comparison remains
synchronous. This is not a validator for malicious JavaScript objects. Schema
mark exclusions may remove other marks when constructing a model; such remaining
nonignored differences are visible rather than attributed to comments.

Motivation: [a consumer's annotation-noise report](https://github.com/ueberdosis/tiptap/issues/6214#issuecomment-2786166119)
and [another consumer's filtering difficulty](https://github.com/ueberdosis/tiptap/issues/6391#issuecomment-3505025519).
Tiptap already [provides ignoredMarks/ignoredNodes](https://github.com/ueberdosis/tiptap/issues/6214#issuecomment-4186579316);
this is a narrow local consumer aid, not a claim that upstream remains unsolved.

Types are supplied beside this example in `annotation-policy.d.mts`. The helper
is not shipped as a new root package API. Test with
`npx vitest run test/annotation-policy.test.js`.
