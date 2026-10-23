# Native Node source entry

On baseline `8d4a8c7c02aea6bcd9810fa7b29a9640d7a5b719`, after installing the
locked dependencies, Node 24.19.0 running
`node --input-type=module -e "await import('./src/index.js')"` fails with
`ERR_MODULE_NOT_FOUND` for `src/DiffType`. The public entry re-export omitted
the `.js` extension. Bundler-based tests resolved it, so they did not expose
this existing compatibility defect. It is not a regression introduced by this
change.

The fix adds only that extension. Package module format, dependencies and API
behavior are unchanged. Git checkouts must build before using package entries
that point into the generated `lib/` directory.

The standalone `test/smoke-metadata-exports.mjs` now imports the public source
entry with native Node, alongside built CJS and ESM. It checks export parity,
legacy helper availability, `DiffType` values, whole emoji grapheme replacement,
both metadata APIs with exact ranges, a block insertion with exact ranges and
original nodes, and a valid legacy combined result with an insertion mark.
It remains outside unit-test discovery and runs after the library build.

## Validation

- Full Vitest suite: 284 tests passed across 26 files.
- TypeScript 5.9.3 checkJs of `src/index.js`, ES2022 target and bundler module
  resolution: passed.
- Rollup library build: CJS, ESM and UMD passed.
- `node test/smoke-metadata-exports.mjs`: native source, CJS and ESM passed.
- Vite production builds using metadata, blocks and legacy configs: passed.
- `git diff --check`: passed.

The observed runtime is Node 24.19.0, not a compatibility matrix for older Node
versions. The existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains; this
change intentionally does not add a package `type` or `exports` declaration.
No browser behavior or performance change is claimed.
