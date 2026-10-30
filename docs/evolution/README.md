# Engineering investigation records

This is an evidence log, not a commit quota. Each subsequent round should record
the base commit, reproduction, alternatives, validation, limitations and next
decision. Keep a round research-only when no reliable change is justified.
Changes require independent review before merging.

| Date | Status / provisional investigation |
| --- | --- |
| Oct 21 | Completed: [text-run/inline-leaf crash](2026-10-21.md) |
| Oct 22 | Completed: [public node-copy API](2026-10-22.md), [grapheme comparison](2026-10-22-grapheme.md), [structured metadata comparison](2026-10-22-metadata.md), [read-only metadata example](2026-10-22-metadata-demo.md) |
| Oct 23 | Completed: [top-level block changes](2026-10-23-blocks.md), [consumer DOM and range regressions](2026-10-23-dom.md), [block review example](2026-10-23-block-demo.md), [nested block details](2026-10-23-nested-blocks.md), [caller-selected node metadata](2026-10-23-node-metadata.md), [nested review example](2026-10-23-nested-demo.md), [selected-node metadata example](2026-10-23-node-metadata-demo.md), [metadata boundary regressions](2026-10-23-metadata-boundaries.md), [selected-block text review](2026-10-23-text-review.md), [asynchronous text review](2026-10-23-text-responsiveness.md), [paginated text details](2026-10-23-text-pagination.md), [composition contract regressions](2026-10-23-composition-contracts.md), [marked text review](2026-10-23-marked-text-review.md) |
| Oct 24 | Completed: [executable snapshot review report](2026-10-24-headless-review.md); investigated: [official table-model integration](2026-10-24-tables.md) |
| Oct 25 | Completed: [annotation review policy](2026-10-25-annotation-policy.md) |
| Oct 26 | Research-only: consumer counterexamples and table acceptance samples; no merged change |
| Oct 27 | Completed: [interactive table review and documented entry](../../example/table-review/README.md) |
| Oct 28 | Completed: [local table JSON inputs](2026-10-28-local-table-input.md), [selected table metadata](../../example/table-review/README.md#selected-event-details) |
| Oct 29 | Completed: [partial table paragraph text details](../../example/table-review/README.md#partial-text-snippets-in-a-selected-paragraph) |
| Oct 30 | [Current capabilities, validation and remaining boundaries](2026-10-30-status.md) |

Reorder these topics based on reproduced failures and user reports. No future
round is marked completed or scheduled by this file. No usage/adoption claims
are inferred from repository activity.

Completed: [legacy renderer schema validation](2026-10-23-legacy-schema-validation.md).

Completed: [incremental text highlights](2026-10-23-incremental-text-highlights.md).

Completed: [legacy combined-view recovery example](2026-10-23-legacy-migration.md).

Completed: [mark-description pages](2026-10-23-mark-description-pages.md).

Completed: [native Node source entry](2026-10-23-native-source-entry.md).

Completed: [public TypeScript contracts](2026-10-23-public-types.md).

Completed: [ProseMirror model compatibility matrix](2026-10-23-model-compatibility.md).

Completed: [generated contract audit and package availability](2026-10-23-generated-contracts.md).

Completed: [validated table snapshot consumer](2026-10-24-table-consumer.md).

Completed: [independent source formatting inventories](2026-10-24-source-formatting.md).

Completed: [saved-report event discovery](2026-10-24-event-directory.md).

Historical entries describe evidence available at their recorded stage. Later
acceptance and merged status are summarized in the [status review](2026-10-30-status.md).
A former candidate label in a dated record is not the current delivery status.
