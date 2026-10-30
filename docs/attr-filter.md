# Ignore attributes during structured comparison

```js
const options = {ignoreAttributes: ['id']}
const blocks = compareDocumentBlocks(oldDoc, newDoc, options)
const metadata = compareDocumentMetadata(oldDoc, newDoc, options)
const selected = compareNodeMetadata(oldNode, newNode, {
  ...options, oldFrom: 12, newFrom: 20,
})
```

The optional list applies to direct keys in **both node and mark attributes**,
including document-level attrs. Nothing is ignored by default. It does not
remove nested keys inside an attribute value, mark/node types, or text. Unknown
names have no effect. Duplicate names are accepted and reported once. Invalid
lists (including sparse arrays and non-string entries) throw `TypeError`.

Filtering changes the comparison projection, not either original document.
Returned block nodes are still original references; all coordinates address
the original documents. Metadata records still contain complete detached raw
before/after snapshots, including ignored keys, when a nonignored value differs.
Ignored values still undergo metadata snapshot validation. Structural/text
restrictions, same-schema checks and node validity checks are unchanged.

With a nonempty list, block results carry
`comparison: {ignoredAttributes: ['id']}`. Every nested details object, including
fallback or depth-truncated details, carries the same policy. The default and
empty-list result shapes remain unchanged. These filtered events describe only
changes under that policy: **do not reconstruct the complete new raw document
by applying them to the old document**. An ignored-only change has no event;
retain both originals to preserve all raw values. Default comparison remains
unfiltered. No identity or move inference is introduced.

Nested eligibility, prefix/suffix equality and LCS matching use the same policy.
Adjacent text runs separated only by ignored mark attributes compare as one run
without merging original nodes. The existing shared matrix budget is unchanged;
projected equality, normalization, validation and output cost are outside that
budget. Filtering is not an elapsed-time guarantee.

The legacy mixed-document APIs (`diffEditor`, `patchDocumentNode`,
`patchTextNodes`) do not support this option and explicitly reject it with
`RangeError`. They cannot preserve both versions' ignored metadata in one
mixed result. Use the structured APIs and independently render the originals.

The example-only headless `reviewDocuments` saved-report helper also rejects a
nonempty `ignoreAttributes` list with `RangeError`. Its v1 report options and
selected-node refinement do not preserve a filtering policy, so accepting it
would make saved reports and replay inconsistent. Default and empty-list usage
remain supported. This restriction does not affect the public structured APIs;
use those directly for filtered comparisons. No saved-report format or replay
protocol has been extended.
