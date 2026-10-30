# Aligned original document review

`example/src/aligned-review.js` is an example consumer, not a package export. Import its CSS explicitly:

```js
import {mountAlignedReview} from './src/aligned-review.js'
import './src/aligned-review.css'
const view = mountAlignedReview(host, {before: oldDoc, after: newDoc, options: {maxCells: 100000}})
view.update({before: anotherOldDoc, after: anotherNewDoc})
// Before removing the host:
view.dispose()
```

Inputs are already validated ProseMirror documents from the same schema. A table caller must run its existing schema/grid preflight first. This renderer supports the example paragraph/heading, list, container, image-label and table profiles, not arbitrary schema extensions. Images are represented by literal source/alt labels without loading remote content. Text marks retain the existing renderer's strong/em/code and non-navigating link presentation; this is not a format-difference engine.

Top-level block events supply whole changed gaps; unchanged blocks receive their own paired rows. Both original documents stay independent. A pair receives the larger content height, observed with ResizeObserver, so later unchanged blocks share vertical positions. Empty insert/delete sides have an original-position placeholder outside tables. Multi-node gaps and long tables remain whole rows: no inferred row/cell identities or aligned internal table rows. Native table structure and spans remain intact.

Both focusable document panes synchronize vertical scroll by corresponding row and within-row ratio, with proportional fallback when no row is available. Expected programmatic scroll positions suppress feedback. Two columns remain side by side on narrow displays; tables may require horizontal scrolling. Horizontal scrolling is independent. Row-height measurements do not provide a total latency guarantee for large documents.

Choose **Review text** on an eligible one-to-one textblock replacement. The existing string-only module worker computes grapheme correspondence; Previous/Next text change applies actual inline highlights or zero-width markers to the original formatted DOM on each side. Raw half-open UTF-16 positions are displayed. Formatting is preserved, not independently compared; zero text hunks do not mean zero format changes. Text may be coarse/nonminimal, and the algorithm does not expose fallback status. The existing combined 20,000 UTF-16 eligibility bound applies. Atoms, unknown marks and incompatible markup remain complete blocks. Selecting another text review, updating or disposing terminates pending work and invalidates late replies. Worker creation/error failure leaves complete originals and an unavailable message without synchronous recomputation.

## Reproducible site presets

With the fixed table schema `schema` (table cells need canonical default attrs):

```js
const p = text => schema.node('paragraph', null, text ? schema.text(text) : null)
const doc = (...children) => schema.node('doc', null, children)
const table = schema.node('table', null, Array.from({length: 50}, (_, i) =>
  schema.node('table_row', null, [schema.node('table_cell', null, p(`Row ${i + 1}`))])))
const presets = {
  insert: {before: doc(p('Anchor'), p('End')), after: doc(p('Anchor'), p('Inserted'), p('End'))},
  remove: {before: doc(p('Anchor'), p('Removed'), p('End')), after: doc(p('Anchor'), p('End'))},
  height: {before: doc(p('Short'), p('Anchor')), after: doc(p('A longer paragraph. '.repeat(40)), p('Anchor'))},
  table: {before: doc(p('Short'), table, p('End')), after: doc(p('A longer paragraph. '.repeat(40)), table, p('End'))},
  unicode: {before: doc(p('e\u0301 cat')), after: doc(p('é cats'))}
}
```

Focused DOM tests cover original references/immutability, insert/delete markers, unequal content measurement, valid long-table structure, two-way scroll and cleanup, actual Unicode highlights, empty-side text markers, stale responses and failure. DOM tests do not substitute for real-browser scrolling, layout, keyboard or production-worker verification.

When `options.ignoreAttributes` is configured, the view displays the policy explicitly. “Unchanged” rows are equivalent under that comparison policy, not necessarily byte-identical original nodes. Original attributes remain on both model inputs. The text adapter intentionally still requires matching original node markup; a replacement that differs in an ignored block attribute may therefore retain only its complete block presentation. Ignoring attributes does not grant extra text refinement coverage.

Scroll geometry relies on `.aligned-pane { position: relative }`: its direct `.aligned-row` children therefore measure `offsetTop` against that pane's scroll-content coordinate system. Keep that positioning rule when embedding the stylesheet. ResizeObserver watches natural content elements, not the row elements whose minimum height is written; equal min-height values are not rewritten. Stable scrollbar gutters reduce width reflow. Real-browser testing remains necessary for font loading, viewport resizing and interactive scrolling.
