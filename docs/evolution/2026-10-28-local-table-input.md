# Local table snapshot inputs (2026-10-28)

Base: `2892100500b8a7383f050d6b153fc097142965f3`.

The table example previously required editing source code to compare a caller's
snapshots. This is an observed integration gap, not a claim of new community
consensus or support for arbitrary schemas. The existing table review README
records the external motivation and alternatives.

The candidate adds two JSON text inputs and an explicit Compare action. Parsing
runs in the existing Worker, followed by the same fixed-schema and table-grid
validation. Each side is capped at 256 KiB UTF-8 before parsing, and the pair at
2,000 document nodes before model construction. Existing depth/grid limits apply.
Editing cancels pending work and clears previous results. Example selection does
not overwrite drafts. Original positions and canonical snapshots remain in the
raw report; original JSON whitespace and object key ordering are not preserved.
No core API, production dependency, upload or persistent storage is added.

Validation adds seven tests: ten fixture pairs are checked inside one test,
plus malformed JSON, byte/node limits, Unicode/marks, grid/schema rejection,
input cancellation, stale callbacks and pre-Worker rejection. The relevant suite
has 23 tests; the full suite has 440. Core and four browser/Worker entry type
checks pass. These limits bound input size, not elapsed time or all rendering cost.

Browser verification established a pasted Unicode/strong-mark snapshot rendered
through the production Worker and that editing cleared both tables and raw data.
Error recovery, repeated source/budget switching and 390/650px input layouts
remain unverified. Keep this candidate unmerged until those interactions pass;
DOM tests do not replace real-browser acceptance. No speedup is claimed.

## Subsequent acceptance and delivery

The incomplete-browser paragraph above records the initial checkpoint, not the
current status. Later production-browser acceptance covered error recovery,
repeated input/source/budget changes, keyboard navigation and 390/650px layouts.
[PR #38](https://github.com/hamflx/prosemirror-diff/pull/38) merged on 2026-10-28
at `8a577df265928ddc808a5a76b8b8797070a249fa`. Its exact head was
`42622d79aaab0a1b594d215bb471fbf846e492d4`; the 440-test suite, source and
browser/Worker types, library and demo builds passed. No remote CI result was
available. The fixed-schema, input-size and preservation limitations still apply.
