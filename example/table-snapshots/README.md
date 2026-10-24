# Offline table snapshot review

This separate consumer uses official `prosemirror-tables@1.8.5` `tableNodes` and
`TableMap`, with the pinned model/state packages in `test/tables-runtime`.
It adds no public library API or production dependency. The older
`example/headless/cli.mjs` keeps its original schema and report contract.

## Setup once, then run offline

From the repository root, supply the absolute path to your existing npm CLI:

```sh
node example/table-snapshots/setup.mjs /absolute/path/to/npm-cli.js
node logs/table-consumer/example/table-snapshots/cli.mjs example/table-snapshots/old.json example/table-snapshots/new.json 0.0.0.0
```

Setup copies the exact source consumers into `logs/table-consumer` and installs
only the separately locked private runtime there. It may access the registry;
it does not publish or change the root dependencies. Re-run setup after source
changes. The resulting CLI performs no installation/network calls, does not
fetch link targets, and does not load caller-supplied schemas or code.

The optional event path is zero-based: root event, row event, cell event,
paragraph event. It is a path through **comparison events**, not a row/column
address or persistent cell ID. Run without a path to inspect the complete tree.
The sample reports same-text strong metadata inside the first cell. Successful
stdout is one complete JSON report. Errors use stderr JSON plus nonzero exit;
stdout remains empty. A valid report may still have selected `block-only` or
`unavailable` coverage; inspect its reason rather than assuming success means
fine details are available everywhere.

## Schema and preflight

The fixed profile supports documents, paragraphs, text, inline tokens, hard
breaks, official tables/rows/cells/headers and strong/em/code/link marks. Cells
contain `paragraph+`; nested tables, arbitrary Tiptap schemas and custom node
attributes are unsupported. Raw JSON rejects unknown node/mark/field/attribute
names (including unexpected attributes that `Node.fromJSON` could ignore),
invalid string type names and malformed supported attributes. `colwidth` is null
or an array matching colspan, containing non-negative safe integers.
Both snapshots use the same schema and pass model validation.

Before **any** `TableMap.get`, both inputs undergo all raw/model and budget
checks. Rowspan/colspan must be positive safe integers. Rowspans extending beyond
the table fail with their real relative cell position. Each table is limited
to 100 rows and 2,000 physical cells. A deliberately conservative estimate is:

```
estimated slots per table = sum(colspan of every physical cell) * row count
sum of estimates across ALL tables on BOTH sides <= 10,000
```

The estimate covers possible active rowspans, but may reject a legitimate large
table whose actual grid is much smaller. It is not an actual grid-cell count.
Checks use division before multiplication/addition to avoid unsafe allocation
arithmetic. After preflight, any official grid problem rejects the whole review;
the consumer never repairs tables or compares invalid grids as if they were
valid. Model validity alone is insufficient for table-grid validity.

Diagnostics identify `side`, `tableOuter` and problem type. `tableOuter` is the
original document's outer position, or null when no table can be identified.
Official `problem.pos` values are relative to table content, not global document
positions. `missing` reports keep their official `row`/`n` without an invented
cell position. A table nested under another is rejected with its containing
outer position and the encountered nested outer position.

Each file is limited to 2 MiB before UTF-8/JSON parsing, including a bounded read
if it grows after stat. Each side permits at most 20,000 JSON nodes and depth 64.
These practical limits are not a malicious-input isolation mechanism, read
timeout, whole-process memory cap or execution deadline. Ordinary local files
are the intended inputs; special/blocking files and adversarial environments
are not supported as a secure service boundary.

## Report and refinement boundaries

The shared model helper preserves complete original snapshots and block trees,
including every available nested fallback/truncated flag. Defaults are block
`maxDepth: 4`, `maxCells: 100000`; these differ from the older CLI's depth 2.
The block cell budget is independent of the table allocation estimate. Empty
or absent nested details do not mean unchanged descendants. Whole-document
`equal` comes from `Node.eq`, after all grid validation, even for identical input.

Only a selected one-to-one replacement is refined. Identical structure/text can
produce metadata at independent original offsets. Eligible pure-text paragraphs
can instead produce grapheme ranges with **text-only partial** coverage;
formatting is not independently compared. The existing 20,000 combined UTF-16
text limit applies; text fallback status is unavailable and no minimal-edit or
runtime guarantee is made. Inline-token insertion is not reduced to textContent.

Real `mergeCells` snapshots retain both cells' paragraphs. Their changed content
is outside metadata-only scope. A multi-row replacement may not automatically
refine to individual cells. This consumer does not guess row/cell identity,
recognize moves, accumulate parent and child events as edits, construct mixed
documents, or provide patch/accept/reject operations. Canonical JSON round trips
preserve loaded model meaning, not the original file's byte spelling.

## Reproduce acceptance

```sh
node test/run-table-consumer.mjs /absolute/path/to/npm-cli.js
```

The runner performs setup, then executes assertions and real offline CLI child
processes in the private runtime. It saves a named-case report to
`logs/table-consumer/result.json`. Coverage includes text/marks/link revisions,
unequal original offsets, real horizontal/vertical merge commands, invalid grids,
allocation checks before TableMap, unknown data, malformed/oversized files,
coarse/truncated reports, JSON round trips and unchanged older CLI behavior.
These are Node consumer checks, not browser/editor or performance acceptance.
