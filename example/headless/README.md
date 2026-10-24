# Saved snapshot review (fixed schema)

Run from the checkout after installing its locked dependencies:

```sh
node example/headless/cli.mjs example/headless/old.json example/headless/new.json
node example/headless/cli.mjs example/headless/old.json example/headless/new.json 0.0.0
```

The second command selects the first root block event, its first child event,
and that child's first event. Paths are **zero-based indices into event arrays**,
not document child paths or node identifiers. The sample selects a paragraph
inside a list item. It reports the accent's original positions and strong-mark
metadata. Select `1` to inspect the separate image attribute change.

Each successful command emits one complete JSON report on stdout. File/JSON,
schema, comparison, or invalid-selection failures print a diagnostic to stderr
and exit nonzero without a partial stdout report. A valid report can contain
`selected.coverage: "unavailable"` if refinement fails; inspect coverage/reason,
not just the exit code. These narrower failures retain the complete block tree.

The report contains:

- `equal`, computed with whole-document `Node.eq`, independent of selection.
- Canonical loaded `snapshots` and the complete `blocks` tree, including JSON
  `before`/`after` nodes and every returned `fallback`/`truncated` flag. Parent
  events remain complete; never sum/apply parent and child events as edits.
- `selected` with the event path, coverage and reason. Metadata is attempted
  only for one selected one-to-one replacement. It uses separate original
  offsets on each side. No automatic semantic identity is inferred.
- Same-text/same-structure metadata records, or `text-only-partial` grapheme
  correspondence for eligible non-atom textblocks with matching markup and only
  text children. Text details preserve original strings and UTF-16 coordinates,
  but do not independently compare marks or establish edit history. Inline atoms
  and hard breaks are not silently reduced to `textContent`. Unsupported cases
  retain `block-only` coverage.

`schema.mjs` defines paragraphs (optional alignment), headings, bullet lists,
list items, images, inline tokens, hard breaks, a strict single-child container,
and strong/em/code/link marks. Both inputs use that same schema. Unknown node,
mark, field and attribute names and invalid supported attribute values are
rejected before `Node.fromJSON` can discard them. Then `Node.check` validates
content and mark constraints. This limited schema-specific check is **not** a
validator or resource/security boundary for arbitrary untrusted JSON. It does
not execute user schema code, fetch image/link URLs, or accept arbitrary Tiptap
schemas/tables. ProseMirror loading can add default attrs and normalize text
runs/mark order: the output preserves loaded model values, not byte-for-byte
input JSON spelling. Canonical snapshots can be loaded again without changing
their model meaning.

The CLI fixes block `maxDepth: 2` and `maxCells: 100000`. Missing details or an
empty depth-limited details array do not prove unchanged descendants; whole
snapshot equality is reported separately. A coarse one-to-one block event may
still have independently valid selected-node metadata/text details, without
removing its original fallback flag. Metadata traversal is synchronous and not
bounded by the block cell budget. Text refinement reuses the example helper's
20,000 combined UTF-16 limit; its algorithm may return coarse/nonminimal results
and exposes no fallback signal or whole-call deadline. The CLI blocks its Node
process while comparing; no server, worker pool, streaming, or latency claim is
made. The exact internal structure-mismatch error message is used only by this
example to distinguish expected metadata rejection from validation errors.

This consumer adds no library API, author attribution, move detection, patch,
accept/reject workflow or document identity model. Server-side/serializable
comparison is not unique: see [Tiptap server comparison](https://tiptap.dev/docs/compare/guides/server-compare).
Relevant usage discussions include [saved-document comparison](https://discuss.prosemirror.net/t/6337),
[marks and attrs](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677),
and [two-snapshot visualization](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328).
These motivate the example, not claims of market size or uniqueness.

Run its focused tests with `npx vitest run test/headless-review.test.js`.

## Optional original formatting inventory

```sh
node example/headless/cli.mjs example/headless/formatting-old.json example/headless/formatting-new.json 1 --formatting
```

`--formatting` must be the final argument and requires an explicit event path.
Without it, the report is unchanged. With it, `selected.sourceFormatting`
contains an independent inventory of each eligible original paragraph's text
runs. Each side has its own content `from`/`to` and ordered `runs` containing
half-open UTF-16 `from`, `to`, original `text`, and detached supported `marks`
with primitive attributes. Unmarked runs have `marks: []`; an empty original
has an empty runs array. Boundaries follow the loaded ProseMirror text runs,
which can differ from raw JSON spelling after normalization.

This is a **source inventory, not a mark diff**. In the mixed fixture, the accent
has its own mark boundary inside a grapheme. That exact original boundary is
retained; it is not expanded to match grapheme text differences. Repeated text
such as `aa` to `a` does not establish which marked character survived. Links and
formatting are listed independently on both sides, without assigning changes,
identity, authorship or edit history. Block attributes are outside this list.
The original `selected.coverage: "text-only-partial"` and text precision warning
remain unchanged for mixed text/formatting revisions.

The inventory shares the text adapter's admission rules: one selected non-atom
textblock on each side, matching block markup, text-only children, supported
strong/em/code/link marks, and at most 20,000 combined UTF-16 positions. Unknown
marks/attributes, inline atoms and hard breaks do not produce a purportedly
complete list. `unsupported` includes the admission reason; preparation or
snapshot errors produce `unavailable` without a partial inventory. Snapshot
collection copies validated primitive model attributes and does not call custom
mark serializers. Neither this example helper nor the fixed-schema input reader
is a security boundary for arbitrary JavaScript objects.

Programmatic consumers of this example can pass `{formatting: true}` as the
fifth argument to `reviewSnapshots`, separate from the fourth block-comparison
options argument. No selected event returns explicit `not-selected` inventory
coverage. This is not a new package API or a broader time/memory budget.

### List paths from a saved report

The standalone directory reads an existing UTF-8 JSON report without running comparison, metadata or grapheme algorithms:

```sh
node -e "const {execFileSync}=require('node:child_process'); require('node:fs').writeFileSync('report.json',execFileSync(process.execPath,['example/headless/cli.mjs','example/headless/old.json','example/headless/new.json']))"
node example/headless/list-events.mjs report.json
```

The Node save command writes the original UTF-8 bytes across platforms. Windows PowerShell 5.1 `>` writes UTF-16 and is not suitable here. UTF-8 BOM is accepted. The same directory command accepts reports saved from the official-table CLI; it needs no table runtime or installation.

Entries retain parents and nested paths (`0`, `0.0`, etc.), zero-based depth, kind, each side's original range and node types/count, containing-layer fallback and details availability/count/truncation/fallback. Root equality, fallback and comparison options remain context. These are **not an additive edit count**. Depth-limited details create no invented paths. Empty insert/delete ranges remain positions. A path can be supplied to the original comparison CLI only with the same snapshots and options; it is not node identity.

This checks only the report fields needed for the directory (including ordered ranges and contained child ranges). It does not authenticate a saved report or rerun schema, model, grid or comparison validation. Unused report data is not comprehensively validated. All entries are emitted or the operation fails: limits are 8 MiB UTF-8 input, 10,000 entries and nested depth 32. These are size bounds, not a read timeout, total runtime deadline or malicious-input sandbox. Failure writes stderr and exits nonzero without partial stdout. Output contains no text previews, inferred moves or patches.
