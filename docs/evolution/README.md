# Ten-day engineering investigation

Research window: 2026-10-21 through 2026-10-30.

This is an evidence log, not a commit quota. Each subsequent round should record
the base commit, reproduction, alternatives, validation, limitations and next
decision. Keep a round research-only when no reliable change is justified.
Changes require independent review before merging.

| Date | Status / provisional investigation |
| --- | --- |
| Oct 21 | Completed: [text-run/inline-leaf crash](2026-10-21.md) |
| Oct 22 | Completed: [public node-copy API](2026-10-22.md), [grapheme comparison](2026-10-22-grapheme.md), [structured metadata comparison](2026-10-22-metadata.md), [read-only metadata example](2026-10-22-metadata-demo.md) |
| Oct 23 | Completed: [top-level block changes](2026-10-23-blocks.md), [consumer DOM and range regressions](2026-10-23-dom.md), [block review example](2026-10-23-block-demo.md), [nested block details](2026-10-23-nested-blocks.md); candidate: [caller-selected node metadata](2026-10-23-node-metadata.md) |
| Oct 24 | Pending: Unicode boundaries in default char mode versus word mode |
| Oct 25 | Pending: empty documents, leaf nodes and nested schema validity |
| Oct 26 | Pending: pathological edit distance and deadline coverage |
| Oct 27 | Pending: allocation and scaling measurements on realistic documents |
| Oct 28 | Pending: public API/bundle compatibility and downstream examples |
| Oct 29 | Pending: independent review and high-value regression gaps |
| Oct 30 | Pending: rerun reproducible validation and summarize actual outcomes |

Reorder these topics based on reproduced failures and user reports. No future
round is marked completed or scheduled by this file. No usage/adoption claims
are inferred from repository activity.
