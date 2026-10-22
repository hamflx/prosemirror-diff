# Read-only metadata review example

Base: `a60ecf69231baad05844f4d7733ac731b3f31cf0`.

The structured metadata API now needs an inspectable consumer. The community
request for [side-by-side review including marks and attributes](https://discuss.prosemirror.net/t/prosemirror-changeset-how-to-also-see-the-changes-in-marks-and-attrs/7677)
motivates an example that keeps both documents intact and shows the returned
metadata rather than attempting to create a schema-breaking mixed document.
This example demonstrates one bounded workflow, not a general review product.

## Scope and implementation

- Separate Vite HTML entry under the existing `example` directory; the legacy
  Vue editor entry and configuration remain unchanged. The root scripts use
  the already locked Vite 7.3.6, now explicitly declared as a dev dependency.
  No runtime dependency or library source changes are made.
- Fixed paragraph/text/image schema and six fixtures: combined changes, bold,
  link target, image attrs, identical documents, rejected text edit.
- Compare the checkout's source API, render each side independently, split text
  at event boundaries, and highlight selected ranges in both documents.
- Change buttons expose their selected state, Previous/Next are bounded,
  selection is announced, and text labels accompany highlighting. Native
  controls remain keyboard-operable. Layout stacks below 650px.
- On an unsupported input, clear old results/highlights, show the error and
  disable navigation. The two original documents remain visible.
- Only the fixture schema is rendered; no arbitrary input, structure mapping,
  mutation, persistence, accept/reject, or deployment is included. Links are
  displayed for inspection, with normal click navigation disabled.

## Validation

From the repository root:

```sh
npm ci --ignore-scripts
npm test
npm exec --package=typescript@5.9.3 -- tsc --allowJs --checkJs --noEmit --target es2022 --moduleResolution bundler --module esnext --skipLibCheck src/index.js
npm run build
npm run build:metadata-demo
npm run demo:metadata
```

105 tests pass (101 existing, four fixture/range tests). Source checkJs and
UMD/CJS/ESM builds pass; CJS metadata export smoke passes. The new tests verify
exact combined ranges `[3,17)`, `[37,50)`, `[52,53)`, text and image lookups,
isolated/empty/rejected scenarios, merged text splitting and UTF-16 offsets.

Browser acceptance on the development entry and built preview:

1. Combined scenario starts with change 1/3 and highlights only “clear decision”.
2. Next selects “project notes” on both sides; next again selects both images
   and disables Next. Selecting the second change from the list locates the
   link range; Previous returns to the first change.
3. Unsupported text edit clears the list and all highlights and disables both
   navigation buttons. Identical documents reports no metadata changes.
4. Built image assets load successfully. No warning/error console messages were
   observed. A 390px viewport stacks the documents with no horizontal overflow.

The production build reports approximately 37.74 kB JavaScript (12.57 kB gzip),
2.17 kB CSS and two 0.30 kB SVG fixtures. This is build output size, not a runtime
performance comparison or a speedup claim. Library benchmark code is unchanged.

Next: independently review the consumer and its limits; consider broader schema
rendering only alongside an explicit input contract. Metadata snapshot boundary
tests and text-node direct-input contracts remain separate follow-ups.
