# Capability laboratory and comparison policy

## Scope

The laboratory exposes aligned original documents, synchronized scrolling, in-block grapheme highlights and direct attribute exclusions alongside existing structured, metadata, table, JSON and offline consumers. The capability matrix distinguishes public package APIs from example helpers. No production dependency was added.

## Architecture review

Comparison projections stay internal to the structured core. They never edit original nodes, and filtered block results carry their policy. Consumers must retain both originals: ignored-only differences intentionally have no event. Metadata records retain complete raw snapshots; callers must save the supplied policy alongside these arrays.

An independent integration review found that the existing headless v1 report accepted arbitrary options but did not carry an attribute policy through selected-event refinement and replay. This batch explicitly rejects nonempty attribute filters in that consumer. Extending its saved format without a replay contract would be misleading; a future version needs end-to-end policy serialization tests.

The aligned renderer uses whole top-level gaps, keeping tables intact. It delegates string comparison to the existing Worker and formatting to the existing source renderer. The laboratory is a composition entry, not another diff engine. Unsupported schema nodes remain explicit failures rather than guessed HTML.

Review also identified disabled navigation focus and border-box height accounting. Both have dedicated regressions. The browser check confirmed matching long-table row positions after including row borders and padding in the shared height. Navigation moves focus to the remaining enabled direction at a boundary.

## Remaining debt and priorities

1. Plain-data equality is duplicated in metadata and attribute projections. Consolidate only after proving equivalent behavior for the validated input domains; it is not a reason to broaden accepted metadata.
2. The static laboratory composes existing standalone entries in frames. This preserves tested controllers but leaves some controls in English. A shared presentation layer and localization can improve consistency without merging their lifecycle state.
3. A generic schema renderer, row/cell identity matching, move detection and historical attribution remain outside the contract. Add them only with concrete consumers and independent semantics.
4. Matrix budgets do not bound projection, rendering or validation cost. Existing sparse-edit measurements do not justify a general equality cache or automatic pagination.

Every coherent feature group should repeat this review of module boundaries, policy propagation, duplicated logic, dependencies, regression coverage and documented limitations. Refactoring should address observed maintenance risks and retain the same validation gates.
