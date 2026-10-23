# Legacy renderer schema validation boundaries

Base: `ce3da52f1fb6efd35f111b3051c338502fdebaae`.

## Problem and behavior change

The [composition counterexamples](2026-10-23-composition-contracts.md) reproduced
valid inputs whose mixed legacy output failed ProseMirror `Node.check()`:
exclusive `code` marks combined with `diffMark`, and `code_block` nodes disallowing
all child marks. A strict single-child container can likewise become invalid when
both replaced children are inserted into one mixed document.

The legacy renderer now explicitly rejects these unrepresentable outputs with
`RangeError` rather than returning invalid nodes. It does not silently remove
source marks, filter `diffMark`, change the schema or claim to render every valid
schema. Callers can retain the two original documents and use external block or
metadata results when a mixed result cannot be represented.

`diffEditor` decodes JSON through the existing `Node.fromJSON` path and then uses
the checked `patchDocumentNode` boundary. `Node.check()` failures are prefixed with
`Invalid input node:` or `Diff output cannot be represented in the original schema:`;
the original `RangeError` is retained as `cause`. Non-validation exceptions are
not swallowed. Existing decoding, option and construction errors retain their
existing behavior.

The original ProseMirror 1.18.1 check recursively validates content expressions
and mark sets, without validating arbitrary attribute values. Newer versions
may run schema-defined attribute validators during checks or construction. The
library delegates to the installed version's behavior and does not guarantee a
fixed error phase. This is not general-purpose JSON validation, proof of
provenance, or a promise of bounded execution time.

## Public helper boundaries and compatibility

- `patchDocumentNode`: checks both input subtrees and final output.
- `patchTextNodes`: checks input text nodes and each final returned text node.
- `createDiffNode`: checks the original subtree and recursively marked result.
- `createNewNode`: checks the completed copy only. An invalid placeholder's old
  content may be replaced by valid children, preserving its repair use case.
  `TextNode.copy` behavior and the existing missing-type error remain unchanged.
- `createTextNode`: checks the returned text node's own mark set. Without parent
  context, text helpers cannot promise that every possible parent allows those marks.

Valid ordinary results retain their original comparison and marks. No-change
exclusive-mark content and mark-disallowing blocks still work, including schemas
without a `diffMark` type when no diff mark is needed. Existing incompatible
`diffMark` combinations are rejected rather than normalized or silently replaced.
The intended compatibility change is refusal to return invalid mixed nodes; it
is not a change to alignment, Unicode segmentation or the meaning of changes.

## Avoiding repeated full-subtree validation

Internal recursion and construction use private unchecked helpers; only public
boundaries perform full checks. A nested call therefore does not recursively
recheck each ancestor subtree. A 60-container regression counts `Node.check`
visits and verifies one pass over each input plus one over the final output.
This guards against adding quadratic validation work with depth; it is not a
claim that the complete diff algorithm is linear or has a whole-call deadline.

## Validation

- `node node_modules/vitest/vitest.mjs run`: 260 tests / 22 files passed, including
  14 validation-boundary tests. Cases cover all three text levels, allowed and
  exclusive marks, mark-disallowing blocks, strict child structure, invalid
  inputs, unchanged paths, source preservation, helper boundaries, existing
  diffMarks, placeholder repair and validation traversal counts.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD/CJS/ESM passed.
- `node test/repro-legacy-mark-validation.mjs`: both counterexamples in char,
  word and grapheme modes now report an explicit renderer rejection rather than
  a returned invalid output. The historical baseline evidence remains in the
  earlier composition record; this script reports current behavior without
  treating invalid output as a desired test result.
- `node test/smoke-metadata-exports.mjs`: CJS/ESM metadata checks passed; existing
  module-type detection warning remains unchanged.
- `node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`: passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`: passed.
- `git diff --check`: passed.

The validation passes add work proportional to the inspected node trees. No timing
speedup is claimed. Applications relying on a previously returned invalid node
must handle the explicit rejection or adopt an external presentation; silently
losing marks is not a compatibility fallback.
