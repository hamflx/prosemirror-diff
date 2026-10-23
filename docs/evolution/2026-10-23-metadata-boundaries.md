# Metadata contract boundary regressions

Base: `80efe3f0ed6349f5b69ade4741e2a131118f722b`.

## Motivation and scope

The document and selected-node metadata APIs share snapshot and traversal code.
A refactor could preserve visible values while accidentally sharing nested attrs,
losing ordinary JSON keys, mutating immutable inputs, or applying a content-start
rather than outer-start offset. These are public contract boundaries suitable for
small regression tests. No runtime behavior, dependency or public API changes in
this batch; no newly discovered correctness bug or speedup is claimed.

Four focused tests cover:

1. JSON-parsed own `__proto__`, `constructor` and `toString` keys survive as data,
   with detached snapshots. Updating returned data does not mutate the inputs or
   create a property on `Object.prototype`.
2. A null-prototype dictionary compares by data with an ordinary object despite
   key order, and changed nested array/object values are detached.
3. Deeply frozen node attrs, mark attrs, marks, fragments and nodes remain readable
   through both APIs. Returned snapshots stay mutable; input values are compared
   with an independent pre-call clone and explicit original values.
4. Whole-document and selected-node records agree for a Unicode formatting split
   and paragraph attrs at the same document position. Different two-side bases
   retain the same metadata with exact independently translated UTF-16 ranges.

The tests assert consumer-visible values and detachment, rather than reproducing
the implementation or exhaustively enumerating value combinations. The earlier
read-only audit covered additional ordinary metadata combinations; that exploratory
matrix is not counted as automated tests in this batch.

## Reproduction and validation

- `node node_modules/vitest/vitest.mjs run`: 188 tests in 14 files passed (184
  existing and 4 new). This succeeds without prebuilt library bundles.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD, CJS and ESM
  bundles built successfully.
- `node test/smoke-metadata-exports.mjs`: CJS and ESM exports returned the exact
  expected node/document records and rejected direct text-node inputs. This is a
  separate post-build smoke script, not part of unit-test discovery.
- `git diff --check`: passed.

The export smoke was run on Node 24.19.0. Direct import of the existing `.esm.js`
bundle uses Node's module-syntax detection and emits `MODULE_TYPELESS_PACKAGE_JSON`
because the package has no `type` declaration. The warning is retained; the test
does not claim compatibility with Node versions lacking this loading behavior.
No package module settings are changed because that would affect existing CJS
consumers. UMD is built, but this smoke does not execute UMD in a browser.

These tests cover supported ordinary data, not arbitrary hostile JavaScript
objects. They do not establish security isolation, preservation of object
prototypes in snapshots, or semantics for getters, custom array methods/subclasses
and named array properties. Sparse-array exploratory results are not promoted into
a new public contract. Deep-freeze validation is not a performance benchmark.
