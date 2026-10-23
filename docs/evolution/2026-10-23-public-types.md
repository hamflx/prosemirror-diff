# Public TypeScript contracts

Baseline `c10cbf6` had no package declaration. A strict TypeScript 5.9.3 package
consumer reported TS7016. An allowJs consumer of metadata comparison could assign
an offset to a string or call an invented record method: the negative assertions
were unused (TS2578), because the inferred return was `any[]`. These are existing
delivery gaps, not newly introduced runtime failures.

The root declaration now covers every public runtime export. `package.json`
declares its type entry and includes it in the package file list. Metadata
records discriminate attrs from marks and preserve numeric ranges; block
details preserve their optional nesting and local termination flags. Metadata
JavaScript has explicit record JSDoc, sharing only the recursive plain-data type
with the root declaration. There are no adjacent source declarations masking
the implementation during checkJs. Runtime behavior and dependency versions
are unchanged.

## Resolution boundary

The locked ProseMirror 1.18.1 exports ESM declarations, but its CommonJS export
does not resolve a declaration under NodeNext. Type-only resolution-mode import
in the package declaration selects its real ESM types. This syntax requires
TypeScript 5.3 or newer; validation here uses 5.9.3 only. It does not modify
runtime resolution or repair a consumer's separate direct CommonJS import of
ProseMirror. Source Bundler fixtures check Node contracts and metadata shapes;
source NodeNext fixtures check metadata shapes only, because its Node types can
still be `any`. This limitation is explicit rather than hidden by skipLibCheck.

## Validation

- Four strict TypeScript 5.9.3 fixture configurations passed: package and source,
  each in Bundler and NodeNext, with the distinct source scope described above.
  Positive uses cover all exports; negative cases check offsets, marks, node
  inputs, options, JSON shape, invalid operations and nonexistent fields.
- Full-source checkJs, ES2022/Bundler: passed.
- Vitest: 284 tests across 26 files passed.
- Rollup CJS/ESM/UMD and all three Vite examples: passed.
- Native source/CJS/ESM API smoke: passed.
- Declaration export inventory smoke: every runtime export covered.
- `npm pack --dry-run --json --ignore-scripts` includes `index.d.ts`; no package
  was published. Existing Node module-type warnings remain.

Types cannot prove schema identity, valid JSON content, acyclic finite metadata,
safe positions or representable output. Runtime validation remains authoritative.
