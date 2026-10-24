# Independent source formatting inventories

Base: `b4dad7338b293a1f34df4a824a165f05533a8064`. Investigation date: 2026-10-24.

## Consumer task and evidence

The October 2–4, 2024 [marks and attrs discussion](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
asks for two-snapshot, side-by-side review including marks. Replies explain
changeset's narrower purpose and suggest inspecting recreated transform steps.
The thread does not demonstrate a completed general solution. It supports the
review task, not a claim of adoption or a unique feature: [Tiptap Compare](https://tiptap.dev/docs/compare/getting-started/overview)
already supports headless client/server comparison.

A baseline reproduction selects a paragraph changing linked `aa` to strong `a`.
The existing report correctly says `text-only-partial`: selected details contain
plain strings, starts and text hunks, while mark data remains in the original
block JSON. A consumer answering "which original ranges carry links or formatting
on each side?" must separately traverse that JSON and reconstruct coordinates.
That is the narrow gap addressed here. The inventory cannot answer which of the
two repeated letters survived, or identify a historical mark-add/remove action.

## Contract

An explicit consumer option requests independently positioned text-run inventories
for the selected event. Each side includes unmarked runs as well as supported
marks, covering exactly that original text. Coordinates remain UTF-16 positions
in that side's original document. A mark boundary may split a grapheme; it is not
expanded to a text-diff or grapheme boundary.

The data describes source formatting, not changes in formatting. There is no
cross-side run pairing, identity claim or upgrade from partial text coverage.
Unsupported nodes, marks or excessive selected text produce an explicit
`unsupported` result; preparation or snapshot failures produce `unavailable`.
Neither returns a silently incomplete inventory. Complete parent
events remain present. Default reports and public package APIs remain unchanged.

## Acceptance and limits

Acceptance covers mixed text/strong/link changes, repeated text, marks splitting
combining/ZWJ sequences, independent offsets, unmarked and empty runs, detached
snapshots, unsupported inputs, the original CLI default, opt-in subprocess output
and table-cell consumption. Validation passed 366 Vitest tests across 29 files,
including 12 new source-inventory tests; library and consumer checkJs; three
library formats, export smoke checks and production example builds. The isolated
table runner passed 22 acceptance cases, counted separately from Vitest.
Independent review reran the 12 new tests and 22 table cases. Two fixture pairs
also produced byte-identical default CLI stdout against the preceding revision.
Reproduce with `npx vitest run test/source-formatting.test.js` and
`node test/run-table-consumer.mjs /absolute/path/to/npm-cli.js`.

The existing selected pure-textblock, matching block markup and combined 20,000
UTF-16 limit apply. That text limit does not bound mark-attribute string sizes
or the whole call's memory and execution time. Node attributes are outside this
inventory; normalized model runs need not preserve the input JSON's segmentation.
This is not a general schema renderer, identity mapper or mark-change detector.
No browser acceptance or performance improvement is claimed.

## Next question: root attrs and changed content

An independent reproduction uses valid documents with root title `A` to `B`
and paragraph text `cat` to `cart`. Block comparison rejects changed root markup;
metadata comparison rejects changed text. Inputs remain unchanged. This is a
composition of documented limits, not a newly introduced core regression.

A possible consumer could report root attributes separately from body comparison,
but it must explicitly distinguish any comparison projection from the original
documents. Existing community title examples do not establish that titles were
stored in document attrs. Without a concrete schema/consumer need, do not silently
normalize root attrs, relax the core contract or add another public API.
