# Table snapshot consumer

Base: `17a3780a08a3cc0443c3b8c545338142303e9f70`. Investigation date: 2026-10-24.

## Evidence and decision

The [official table integration](2026-10-24-tables.md) reproduces model-valid
but grid-invalid inputs and confirms that existing block/metadata/text results
can inspect selected cell content without building a mixed table document.
The remaining consumer gap is an executable path from saved table JSON to a
validated, serializable report, rather than another comparison API.

The June 2026 [suggestion rendering discussion](https://discuss.prosemirror.net/t/suggestions-as-decorations/9027)
describes schema and table assumptions broken by inserting suggested content.
It motivates preserving the two originals; this example does not resolve the
thread's editable-suggestion workflow. The
[two-snapshot discussion](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328)
includes partial custom-node solutions, not evidence that generic pairing is
solved. Headless comparison itself is not unique to this project; Tiptap also
provides [server comparison](https://tiptap.dev/docs/compare/guides/server-compare).

## Contract

The [table CLI](../../example/table-snapshots/README.md) owns a small schema
using official table nodes with paragraph-only cell content. It rejects unknown
JSON fields and unsupported structure instead of silently discarding them.
Both inputs pass model checks and conservative allocation preflight before any
TableMap computation. Grid problems reject the entire comparison with a side,
table position and original problem details; there is no automatic repair.

The report reuses the existing example's model-based comparison logic. Complete
parent events, original coordinates, fallback/truncation flags and selected
coverage remain distinct. An event path is an index into comparison events,
not a cell ID. Text detail does not independently compare formatting, and real
cell merges may change paragraph structure beyond metadata-only coverage.

Setup installs the existing private locked tables runtime separately. The CLI
does not install packages or fetch input URLs. Root production dependencies and
package exports remain unchanged; the original fixed-schema CLI retains its
contract through a thin wrapper around the extracted example helper.

## Validation and limits

Acceptance covers cell text and same-text marks/link attributes, unequal original
offsets, genuine merge commands, model-valid invalid grids, allocation preflight,
atomic CLI failures, canonical JSON round trips and old-consumer compatibility.
Candidate validation passed all 354 existing Vitest tests across 28 files,
library checkJs, the three library formats, export smoke checks and production
metadata/block/legacy example builds. The separate table-consumer runner passed
20 named acceptance cases, including actual CLI subprocesses; these are not 20
additional Vitest tests. The new CLI, setup and runner passed TypeScript 5.9.3
checkJs against the pinned runtime. Independent review reran the 20 cases and
checked the final code and documentation. Reproduce the consumer acceptance with
`node test/run-table-consumer.mjs /absolute/path/to/npm-cli.js`.

The slot estimate is conservative, so some valid tables can exceed its limit.
File, node, depth and grid limits are example product constraints, not a whole-call
deadline or a general malicious-input isolation boundary. No performance
improvement is claimed. Nested tables, arbitrary custom schemas, editor DOM,
selection editing, patch application and inferred cell identity are outside scope.
