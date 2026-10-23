# Legacy combined-view recovery

The schema-validation change rejects combined documents that ProseMirror cannot
represent. A consumer must clear an earlier combined result and retain both
originals when that specific output validation fails. An unavailable combined
view does not mean that the documents have no differences.

The historical Vue example imports package version 0.0.3 and has no local-source
alias. Its `reloadDiff` does not catch errors, but it has not adopted the current
validation behavior. This batch leaves that dependency stack unchanged and adds
an independently runnable current-source example at `example/legacy.html`.

## Recovery contract

The example-only adapter recognizes a `RangeError` with the documented output
validation prefix and a `RangeError` cause. It rethrows invalid-input errors,
other range errors, and unexpected programming errors. This is a recipe for the
current error contract, not a new library API or a generic exception handler.

Four fixed, valid schema fixtures demonstrate a supported strong-mark edit,
exclusive code marks, a code block forbidding marks, and a container allowing
exactly one child. The sources are independently rendered without changes to
their marks or schema. Rejected combined output is cleared; switching back to
the supported fixture restores it. There is no automatic full-review fallback,
node pairing, or claim that metadata comparison handles simultaneous text edits.

## Validation

- `node node_modules/vitest/vitest.mjs run`: 277 tests passed, including ten
  adapter/fixture cases and three actual-entry DOM cases. The latter use jsdom,
  not a real browser. An invalid input is constructed through unchecked node
  creation so that the API boundary itself is exercised.
- TypeScript 5.9.3 `tsc --allowJs --checkJs --noEmit --target es2022
  --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: CJS, ESM and
  UMD builds passed.
- `node test/smoke-metadata-exports.mjs`: passed. Node still reports the existing
  module-type warning for direct ESM bundle loading.
- Vite builds with `example/vite.metadata.config.mjs`,
  `example/vite.blocks.config.mjs`, and `example/vite.legacy.config.mjs`: passed.
- `git diff --check`: passed.

Production Chrome verification selected exclusive marks, the mark-forbidding
code block, and the strict container in sequence. Each displayed an unavailable
combined-view status, cleared the combined output, and retained both original
versions. Selecting the ordinary fixture again restored an available combined
result with text `cart`. The observed console contained no warnings or errors.
This browser check complements the jsdom cases above; it does not establish
behavior for arbitrary schemas.

No performance claim is made. Fixed fixtures do not provide an arbitrary-schema
editor, and invalid source documents still require caller correction.
