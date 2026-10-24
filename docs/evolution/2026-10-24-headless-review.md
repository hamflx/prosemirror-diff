# Executable snapshot review report

Base: `48a25e4b44779927e3feef1bea6f55bbd7b0091c`. Investigation date: 2026-10-24.

## Consumer problem and evidence

Loading two JSON documents is already documented. The remaining integration task
is preserving complete block events while explaining what selected-node metadata
or text details actually cover. A machine-readable example makes that composition
usable without adopting the fixed DOM demos or inventing transformation history.

- [Saved novel revisions without steps](https://discuss.prosemirror.net/t/how-to-compare-the-differences-between-different-texts-no-steps/6337)
  (2024-04-10–11): the author reported success using this library. This is a solved
  consumer workflow, not an unresolved issue or a user-count estimate.
- [Snapshot marks and attributes](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
  (2024-10-02–04): the requested two-sided block/format review had suggestions but
  no public confirmation of a complete solution. This supports explicit coverage
  of formatting and structural changes in a consumer report.
- [Custom-node snapshots](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328)
  (2025-04-07–2026-03-24): recursive/LCS approaches were reported working in March;
  the later external-title question remained unconfirmed. This example does not
  claim to solve arbitrary NodeViews, external state or table editing.
- [Tiptap server comparison](https://tiptap.dev/docs/compare/guides/server-compare)
  (official documentation observed 2026-10-24) already offers headless comparison
  and serializable changesets. These are not unique capabilities. Its warning
  about synchronous comparison is relevant: a CLI recipe is not an HTTP-service
  latency guarantee or a reason to add a worker pool here.

## Smallest useful scope

Provide a fixed-schema Node example reading two synthetic JSON snapshots, writing
a JSON report to stdout, and optionally inspecting a caller-selected nested event.
Keep the full block tree with original ranges, before/after content and each
layer's fallback/truncation status. Selection identifies a result path, not a
persistent node identity. Parent and child events are not additive edit counts.

Same-text/same-structure selected pairs may expose metadata. Supported textblock
replacements may expose grapheme details, explicitly partial with respect to
formatting. Inline atoms, ambiguous multi-node gaps and unsupported pairings keep
their complete coarse event. Input errors and unexpected validation failures must
not be reported as equality. Overall equality comes from the original model
nodes, not from an empty detail list.

The schema and report format belong to the example, not the package API. No
production dependency, editor, patch application, author inference, moves,
HTTP service or schema-code loading is added. JSON loading is constrained to the
example schema; it is not a general schema migration or hostile-input sandbox.

## Acceptance

Exercise the real CLI for valid JSON stdout and invalid-input stderr/nonzero
exit. Verify same snapshots, formatting/link/image changes, different original
offsets, mixed text/marks, Unicode reconstruction, strict single-child replacement,
nested lists, inline atoms, multi-node gaps and budget/depth fallback. Preserve
input data and JSON round-trip output. Do not infer precise coverage from empty
truncated details. Run the complete existing tests, source type check, library
build and export smoke after independent review of the implementation.

## Candidate verification

The focused suite passes 22 tests including real CLI subprocesses. The full
suite passes 354 tests in 28 files, with source checkJs, CJS/ESM/UMD builds,
export smoke and the existing three demo builds passing. Independent review
also ran the 22 focused tests. The CLI is the user interface for this example;
these checks do not claim browser acceptance for other examples.

An additional CLI checkJs initially exposed missing Node ambient declarations
and an existing broad boolean inference in the reused text helper. Validation
uses isolated `@types/node@24.0.0` with TypeScript 5.9.3; no project dependency
was added. Two literal JSDoc annotations preserve the helper's runtime behavior
while allowing its return union to narrow. CLI checkJs and 30 focused
helper/consumer tests then pass. The check command, using a separate validation
type directory, is:

```sh
tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck --typeRoots <validation-directory>/node_modules/@types --types node example/headless/cli.mjs
```

## Limits and next decision

The block cell budget bounds alignment matrices, not total traversal, snapshot
or serialization cost. Text detail limits are not whole-call deadlines. No
speedup is claimed. Full custom schemas, table-grid semantics and collaborative
review remain separate design problems. A useful next investigation is a specific
consumer schema with reproducible unsupported cases, not new options without
evidence or a generic review engine.
