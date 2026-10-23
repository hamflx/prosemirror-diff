# ProseMirror model compatibility matrix

The declared `prosemirror-model` range is `^1.18.1`. A locked installation alone
does not establish behavior across that range. This matrix samples four versions
without changing the library's dependency declarations or lockfile:

| Model | Reason | source / CJS / ESM semantics |
| --- | --- | --- |
| 1.18.1 | Declared minimum and current lock | Pass / pass / pass |
| 1.19.1 | CommonJS declaration resolution milestone | Pass / pass / pass |
| 1.22.0 | Attribute validation milestone | Pass / pass / pass |
| 1.25.12 | Registry latest observed on 2026-10-23 | Pass / pass / pass |

Version milestones come from the [official changelog](https://github.com/ProseMirror/prosemirror-model/blob/master/CHANGELOG.md).
The latest version was checked with `npm view prosemirror-model version`.
These are runtime tests, not TypeScript consumer checks.

## Reproduction

Install the checkout's locked development dependencies, then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node test/run-model-matrix.mjs /absolute/path/to/npm-cli.js
```

The explicit npm CLI path allows direct Node execution without shell quoting.
The runner builds once, creates private cells under ignored `logs/model-matrix`,
installs each exact model version with other runtime dependencies pinned to the
root lockfile, and copies the same source and generated bundles into every cell.
ProseMirror is external in the Rollup configuration. Every cell resolves both
CommonJS and ESM model instances inside its own `node_modules`; each API uses
the matching Schema instance. Cell lockfiles and full results remain available
locally. The runner compares semantic output across versions and reports
capability observations separately.

Assertions cover metadata ranges and before/after values, selected-node offsets,
whole graphemes, block reconstruction, nested absolute ranges, zero comparison
budget, unchanged inputs and explicit legacy errors for unrepresentable schemas.
There are 24 fixed-seed generated examples (9 insertions, 3 deletions, 12 edits),
not broad random or exhaustive coverage. Nested details are checked for range
and source content, but not reconstructed independently at every depth. Node
content equality does not prove reference identity.

## Legitimate attribute validation differences

| Model | Invalid attribute rejected during creation | Node.check rejection | Metadata API rejection |
| --- | --- | --- | --- |
| 1.18.1 / 1.19.1 | No | No | No |
| 1.22.0 | No | Yes | Yes |
| 1.25.12 | Yes | Not executed | Not executed |

The initial probe assumed invalid attributes could always be constructed. The
latest model rejected that construction; the probe now records each stage
without claiming later checks ran. This is model validation behavior, not a
library compatibility failure. Valid-input semantic summaries match across all
four versions and three tested entry formats.

Observed runtime: Node 24.19.0. This does not establish older Node compatibility,
all versions within the range, all schemas, UMD browser behavior or performance.
The existing module-type warning remains visible. No runtime behavior, public API
or dependency version is changed by this batch.
