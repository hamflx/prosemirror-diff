# Explicit annotation review policy

Base: `fa0d990bc6716e6ddf3a5c7dfbe720e997b98ef6`.

Consumers report that comment marks create distracting content-change displays
([April 2025](https://github.com/ueberdosis/tiptap/issues/6214#issuecomment-2786166119),
[November 2025](https://github.com/ueberdosis/tiptap/issues/6391#issuecomment-3505025519)).
Tiptap subsequently provided ignoredMarks/ignoredNodes; this is not an unresolved
upstream claim. Our core block events have exact original reconstruction meaning.
Changing Node.eq to ignore marks would compromise that contract.

The example-only `reviewAnnotations` instead retains every successful metadata
record and adds explicit hidden/visible record indexes. Empty policy hides
nothing. Only equal text/structure is admitted by the metadata comparator.
Mixed text changes and failures remain unavailable; mixed nonignored formatting
and attrs remain visible. No block tree, source node, equality result or existing
CLI is rewritten. A separate executable owns its comment schema, preserving the
existing fixed-schema reader's strict validation.

Sixteen focused tests cover policy admission, complete raw retention, defaults,
mixed records, source immutability, JSON-loaded model consistency, nested/inline
leaf coordinates, mark splits inside graphemes, failure without partial output,
and inclusive combined model-node/text limits. These size limits are not a
deadline or sandbox. Adjacent example declarations describe the result union.
No new library export or production dependency is added.

Whole-document admission intentionally means an unrelated text edit prevents
annotation classification anywhere in that pair. This is conservative; selected
subtree policies could be evaluated later with explicit independent offsets.
No claim is made to hide all comment noise in arbitrary revisions.
