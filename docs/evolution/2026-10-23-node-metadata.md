# Caller-selected node metadata comparison

Base: `a9221e578007bc201ddc17fd3ac46b89b8984460`.

## Reproduction and decision

A document with `paragraph('same')` and `paragraph('old')` changes the first
paragraph's strong mark and the second paragraph's text to `new`.
`compareDocumentMetadata` correctly rejects this revision because its whole-input
contract requires identical text. A consumer that already knows the corresponding
first paragraphs could not query only that pair through the public metadata API.
The new test preserves the whole-document rejection and verifies the selected
paragraph produces a marks record over `[1, 5)`.

[The community marks/attrs discussion](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
describes side-by-side revisions needing formatting and attribute information.
The thread also suggests transform-step approaches; it is evidence of a use case,
not evidence that other libraries cannot solve it or of adoption size.
[ProseMirror's node API](https://prosemirror.net/docs/ref/#model.Node.nodeSize)
defines leaf size as one and non-leaf size as content size plus two. The installed
`prosemirror-model/src/node.ts` implementation was checked for these bounds and
recursive `Node.check` validation.

## Contract and compatibility

`compareNodeMetadata(oldNode, newNode, {oldFrom = 0, newFrom = 0} = {})` compares
caller-selected nodes without constructing a temporary document. It reuses the
existing traversal, metadata equality and snapshots. `compareDocumentMetadata`
retains its validations, root content bounds, traversal order and output.

The new input nodes must share a schema instance and type, exact text and non-text
structure. Formatting-induced text splits may differ. Direct TextNodes and document
roots are explicitly rejected; compare the parent or use the document API.
Image leaves and strict single-child containers are supported. Every offset is a
non-negative safe integer at the node's outer start, and offset plus nodeSize must
also be safe. Offsets are independent; descendants start at the parent's position
plus one. Caller-supplied document membership cannot be verified from a node alone.

This does not infer identity, pair multi-node gaps, compare changed text within
the selected pair, or implement patches. Metadata snapshot behavior is unchanged;
plain data is supported, not adversarial JavaScript object isolation. Existing
array/subclass/property behavior is not expanded or hardened in this batch.

## Validation

- `node node_modules/vitest/vitest.mjs run`: 174 tests, 12 files passed (155 existing,
  19 new). Covers the reproduced bridge scenario, split Unicode text/link marks,
  independent offsets, container/leaf ranges, safe integer boundary/overflow,
  detached snapshots, invalid schema/input and rejected text/type/structure edits.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD/CJS/ESM passed.
- CJS smoke: exact independent-offset node marks record, document metadata and blocks exports passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`: passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`: passed.
- `git diff --check`: passed.

No performance improvement is claimed: this batch exposes the same traversal over
a caller-selected subtree. Input validation and snapshots still traverse that
subtree, with no deadline or depth budget added. A timing comparison against a
whole-document call that rejects unrelated text edits would not compare equivalent
successful operations, so no speed ratio is reported.

## Next acceptance target

A consumer may show metadata only for a deliberately paired unchanged-text node.
Any future automatic integration with block changes must separately specify pairing
ambiguity, fallback and text-edit behavior; a single replacement is not proof of
identity. Keep that decision outside this API.
