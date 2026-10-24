# Saved-report event discovery

Base: `e7b379944ade0dbf1001836a1d6e5d09a3e228d7`. Investigation date: 2026-10-24.

## Reproduced consumer task

The fixed-schema snapshot CLI already returns complete original-preserving
reports and accepts a nested event path. To inspect a changed paragraph inside
a list, a new consumer must first find that path. On the existing sample, the
baseline report contains 372 lines and 9,656 characters but only four retained
events: `0`, `0.0`, `0.0.0` and `1`. Selecting `0.0.0` returns metadata details.
The README supplies this sample path; arbitrary input requires traversing the
report tree or writing another script.

The [2024 marks/attrs discussion](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
supports finding and reviewing changes, but does not explicitly request a CLI
directory. Priority here comes from the measured local consumer workflow, not
an invented community feature request. The
[custom-node discussion](https://discuss.prosemirror.net/t/visualize-changes-between-2-tiptap-jsons/8328)
reports partially successful recursive comparisons in March 2026; it does not
justify general node identity or schema normalization. Tiptap already provides
[comparison presentation](https://tiptap.dev/docs/compare/guides/compare-documents),
so navigation is not presented as a unique capability.

## Smallest useful scope

Provide a directory reader for a previously saved example report. Reuse both
the fixed-schema and table snapshot reports without adding flags to their
comparison CLIs or rerunning block, metadata or grapheme comparison.

Each entry identifies the exact retained event path, hierarchy, kind, original
side ranges and node types/counts. Layer fallback and nested detail truncation
remain visible. Parents and descendants are directory entries, not independent
edits to sum or apply. A truncated layer must not acquire fabricated child paths.
Paths apply only to the original report, snapshots and comparison options; they
are not persistent node identifiers.

The first version has no summaries, filters, sorting, pagination or interactive
terminal UI. It outputs every accepted entry. Unsupported or malformed input
must fail clearly rather than silently omit entries. Structural report checks
do not revalidate document schemas or certify that an arbitrary report was
produced by a correct comparison.

## Acceptance

Reproduce the four-path discovery task and feed every listed path back to the
comparison consumer. Verify exact ranges, parent/child hierarchy, empty sides,
independent offsets, Unicode positions, table nesting and fallback/truncation.
Keep input reports unchanged and preserve JSON round trips. Exercise the real
directory process for valid reports and atomic stderr/nonzero failures.

Candidate validation passed 382 Vitest tests across 30 files, library and
consumer checkJs, the three library formats, export smoke checks and production
example builds. The isolated table runner passed 23 acceptance cases, counted
separately from Vitest. Independent review reran the 16 directory tests and 23
table cases, then reran the real-budget local-fallback regression after it
replaced a synthetic flag edit. The maximum supported depth is tested with an
actual 34-container input and depth-32 comparison: 33 event entries plus the
last event's empty truncated details are valid.

The executable save-and-list workflow produced 2,416 UTF-8 bytes for the four
directory entries versus 9,665 bytes for the original sample report. This is
one sample's output size, not a runtime speedup or general compression claim.
No browser acceptance is inferred. Reproduce with
`npx vitest run test/event-directory.test.js` and
`node test/run-table-consumer.mjs /absolute/path/to/npm-cli.js`.

## Deferred work

Root attributes plus changed body content remain a documented composition
boundary, with insufficient concrete consumer evidence to justify normalizing
the roots or relaxing the core API. Automatic identity, table patching and a
general schema framework remain outside this read-only consumer task.
