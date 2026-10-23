# Selected-node metadata review example

Initial base: `3428dcd608bcd39613197549a968cf6037bc48d0`.
Integrated base: `1642da2a537aaaef7296d5f10c4a419cd74d5198`.

## Use case and explicit scope

The [node metadata investigation](2026-10-23-node-metadata.md) established that a
known paragraph pair can be compared even when unrelated document text changes.
This example makes that distinction visible without inventing correspondence.
It extends the existing fixed-schema read-only metadata example, with no new
runtime dependencies or edits to the comparison APIs.

The caller-selected scenario renders three complete paragraphs on each side.
The introduction changes from `Old intro.` to `Updated introduction.`, moving
the selected middle paragraph's outer start from 12 to 23. The closing paragraph
also changes. Only the explicitly selected middle pair is compared, returning:

| Change | Old range | New range |
| --- | --- | --- |
| Added strong on `these notes` | [20, 31) | [31, 42) |
| Link target on `project notes` | [35, 48) | [46, 59) |

The scope banner displays the selected node spans [12, 50) and [23, 61), states
that other text edits are NOT compared, and disclaims automatic matching. The
list heading repeats the selected-paragraph scope. Other paragraphs remain
visible and receive no highlights. `compareScenario` invokes the node API only
for this explicit fixture scope; all previous scenarios retain the document API.

The comparison is intentionally incomplete outside that scope. It is not an
all-changes view, automatic node pairing, arbitrary JSON renderer, or review
editor. Ordinary example link clicks are prevented, but this does not promise
isolation from context-menu or middle-button navigation.

## Validation

- `node node_modules/vitest/vitest.mjs run`: 184 tests / 13 files passed after
  integration (181 existing plus 3 new tests).
- Fixture regression verifies the whole-document API rejects the unrelated text
  edits, the selected pair has exact different-side ranges, both document slices
  match, source snapshots remain unchanged, and records stay within scope.
- Actual example HTML/entry DOM tests verify both complete documents, scope banner,
  exact highlights and navigation, and selected/rejected/empty/full scenario
  switching. They use jsdom with only scrolling stubbed; these automated tests are
  not a real-browser or visual-layout acceptance claim.
- `npm exec --offline --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js`: passed.
- `node node_modules/rollup/dist/bin/rollup -c rollup.config.mjs`: UMD/CJS/ESM passed.
- CJS smoke verified independent-offset node metadata, document metadata and blocks export.
- `node node_modules/vite/bin/vite.js build --config example/vite.metadata.config.mjs`: passed.
- `node node_modules/vite/bin/vite.js build --config example/vite.blocks.config.mjs`: passed.
- `git diff --check`: passed.
- Chrome acceptance: scope spans and exact two-sided `these notes` highlights
  matched the fixture; Tab skipped disabled Previous and visibly focused Next,
  and Enter selected the link change. Selected/rejected/recovered/empty/combined
  transitions cleared and restored the expected ranges, controls and headings.
  At a 390 by 844 viewport the document client/scroll widths were both 375, the
  scope notice remained visible, and no console warnings or errors were observed.
- Production-build Chrome smoke: both combined-scenario SVG images loaded with
  positive natural widths. The selected-node banner retained its complete scope
  explanation; keyboard Next selected link record 2 of 2 at [35, 48) / [46, 59),
  highlighting only `project notes` on each side, not the introduction or closing
  text. No console warnings or errors were observed.

No comparison algorithm changed and no speedup is claimed. The example uses fixed
small fixtures; it does not establish a large-document rendering performance budget.
Future integration of selected-node metadata into block review still requires an
explicit correspondence and rejection policy for changed text or multi-node gaps.
