# Generated contract audit and package availability

Base: `1ab0a45c7e96deda4b3ae04ce4435a91c84ce706`.

Earlier generated block tests reconstructed the root and checked nested ranges,
but did not independently reconstruct each reported child layer. The new tests
use original child boundaries, original node references and unchanged gaps as
their oracle; they do not implement a second LCS algorithm. Each non-truncated
details layer must independently reconstruct its target parent's content.
Truncated details deliberately provide no child-layer reconstruction contract.
Parent and child events are never applied together.

The fixed seed family starts at `0x6d2b79f5`. Test names include the derived seed
and case index. Sixteen cases in each of three groups produce 48 individually
reported tests:

- Blocks: empty inputs, repeated and empty siblings, insertion/deletion/replacement
  inside a section/list/item chain. Both directions independently reconstruct;
  budgets 0, 3 and 10000 and depths 0, 1 and 3 preserve root semantics. Assertions
  require actual deep details and truncation where intended, avoiding empty checks.
- Metadata: original attrs by node position and marks at each UTF-16 unit provide
  independent expectations. Identity, reversed before/after records and separately
  translated old/new offsets must agree. Inline atoms and formatting splits are
  included; a metadata boundary is allowed to split a grapheme.
- Graphemes: concatenated inputs include combining marks, CRLF, regional indicators
  and ZWJ sequences. Reconstructed texts and segment boundaries are checked against
  full-input `Intl.Segmenter` boundaries, never against the concatenation pieces.

Neither block alignment symmetry nor monotonic refinement with increasing budget
is asserted: neither is the API's contract. Zero budget need not cause fallback
when common prefixes/suffixes or a one-sided insertion already settle the result.
Budget tests are semantic checks, not runtime or allocation benchmarks.

This bounded corpus is not exhaustive fuzzing, an arbitrary schema/tree generator,
or a full Unicode conformance suite. The boundary oracle uses the runtime's Intl
implementation, while the library uses its installed segmentation dependency.
Independent implementation does not imply coverage of all Unicode versions.

## Published package versus checkout

On 2026-10-23, the [npm registry metadata](https://registry.npmjs.org/@hamflx%2fprosemirror-diff)
reported latest `0.0.8`, published on 2022-07-28. Inspection of that published
tarball found no root declaration or metadata/block modules, and its CommonJS
exports lack the newer metadata/block/grapheme APIs. The repository's unchanged
version field is not evidence that those changes have been published.

The README now distinguishes the unreleased repository revision from the registry
artifact, including the previously tested locally built tarball. It explains how
to build and locally pack a checkout, then install the explicit archive path.
No version, dependency, runtime API or publication workflow changes are needed.

Run the focused regression suite with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm exec -- vitest run test/generated-contracts.test.js
```

## Validation

- Focused suite: 48 tests passed; independently rerun during test-oracle review.
- Full suite: 332 tests passed across 27 files.
- TypeScript 5.9.3 full-source checkJs and four existing consumer configurations
  passed, retaining their previously documented source NodeNext scope.
- CJS/ESM/UMD library builds, native source/built export smoke and declaration
  inventory smoke passed.
- All three demo production builds and the benchmark build passed.

No runtime defect was reproduced by this bounded audit. No production code,
dependency or runtime API change is proposed, and no performance conclusion is
drawn from test durations. Independent review and exact-head verification are
required before merging.
