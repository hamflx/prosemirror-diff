# Asynchronous selected-text review

Baseline: `2191336d4e1ce14f1ad36ecfb0a8319dc15b1b50`, tree
`521ac039b6427e513eab25afb4aff9cb82b5cd7e`.

## Browser evidence before the change

Node helper timings alone do not establish browser responsiveness. A separate
production-built browser harness therefore used preconstructed textblocks and
the actual example `createTextReview` controller and `renderDocument` renderer.
Buttons selected one input and invoked the controller with either a new cache
or reuse of the preceding same-input controller. String repetition and node
construction occurred at page initialization, outside measurement.

The measured scope is a prepaired single-block controller operation, not the
whole block comparison, block-selection handler, INP or a user population.
A local import wrapper timed the original helper. Controller time minus helper
time includes synchronous DOM mutation and bookkeeping, not all layout or
paint. Preparation was separately timed but belongs to the same input task.
Long Tasks were filtered for overlap with the click-through-second-animation-
frame window. Observer callbacks had a 150 ms reporting allowance; an empty
list would not prove there were no long tasks. Animation-frame callbacks show
rendering opportunities, not physical paint completion.

Eight raw samples were collected in Chrome 155, with the page visible and no
CPU throttling configured by the harness. External throttling settings are
not inferred programmatically. No builds or tests ran during collection.

| Input / cache | Samples | Helper ms | Controller ms | Observed overlapping Long Task ms |
| --- | --- | --- | --- | --- |
| Short Unicode / fresh | 1 | 1.6 | 2.3 | Not used for attribution |
| 10k per side, one edit / fresh | 1 | 4.5 | 4.9 | Not used for attribution |
| High edit distance / fresh | 3 | 239.0 / 233.4 / 220.4 | 239.4 / 239.9 / 220.8 | 265 / 251 / 229 |
| High edit distance / reuse | 1 | 0 | 0.4 | Not used for attribution |
| 600 separated changes / fresh | 1 | 195.1 | 201.5 | 242 |
| 600 separated changes / reuse | 1 | 0 | 26.4 | 63 |

The high-distance samples reproduce a main-thread computation problem. The
cached many-row sample separately shows that layout/rendering work can still
produce a long task without helper computation. This batch addresses computation
only; it does not combine that independent problem with pagination or virtualization.

## Implementation contract

The main thread retains node eligibility and the combined 20,000 UTF-16 size
check. Only strings, absolute starts and a request identifier cross the worker
boundary; ProseMirror nodes are not serialized or transferred. The same pure
calculation is shared with synchronous tests and the helper benchmark, with no
public library API or dependency change. Moving calculation off the main thread
does not claim that algorithm modules are never loaded or evaluated there.

Each new selection immediately clears old text details and shows pending state.
Changing selection terminates any pending worker, then constructs a new worker
only for an eligible uncached request. Request identifiers, worker identity and
disposed-controller checks reject late success, error and message-error events.
Reloading a comparison disposes the old controller. Completed workers terminate;
completed results are cached for that controller. Creation, posting, worker or
message failures show a generic unavailable state and retain full block review.
There is deliberately no synchronous recalculation fallback.

## Validation and after-change method

All 216 tests across 17 files passed. The deferred-worker suite covers pending
state, payload shape, Unicode parity, A-to-B and same-entry cancellation,
late success/error/messageerror, disposal, caching, unsupported/oversize inputs,
creation/posting/response failures, source whitespace restoration and actual-page
reload. A protocol test executes the worker entry with string inputs. These
tests do not substitute for a real browser loading the emitted module worker.
Full source checkJs, UMD/CJS/ESM builds, CJS/ESM metadata smoke checks and both
demo production builds passed, including the emitted worker asset.

The after-change production harness retains the same preconstructed inputs and
actual controller. It separately records dispatch time, worker-thread computation
duration, main-thread result-handler/DOM duration, terminal state and complete
request latency through two animation frames after the result. Worker duration
uses that worker's own clock; timestamps from separate threads are not subtracted.
The first frame after dispatch also records whether the result is still pending.
Long Tasks use the full request window, not merely dispatch. Only terminal state
`ready` counts as a successful result; `unavailable` is reported separately.

The cancellation button starts a high-distance request and immediately selects
a short input in the same click task, using real workers and recording post,
termination and delivery events. It demonstrates cancellation before delivery
and isolation of the final selection. It does not prove computation had already
started, or measure human interaction while that computation was running.

Before/after dispatch and completion are different quantities: lower dispatch
time must not be described as faster completed computation. Worker startup,
serialization, delivery, DOM rendering and layout remain relevant, particularly
for many-row results. No percentile or whole-page responsiveness guarantee is made.

## Production browser observations after the change

Nine raw samples were retained, all with successful final state `ready`.
The same input sizes and controller modes were used; the immediate-switch
sample deliberately ends on the short input. Values below are milliseconds.
An em dash in the computation column means no worker was created for that
cached selection. `none observed` describes the observer output, not proof
that a long task was impossible or that the whole page is responsive.

| Sample / input | Dispatch | Worker compute | Ready | First frame after dispatch / state | Second frame after result | Long Tasks |
| --- | --- | --- | --- | --- | --- | --- |
| 1 / short, fresh | 3.9 | 3.8 | 91.6 | 51.1 / pending | 111.9 | 51 |
| 2 / 10k, fresh | 0.4 | 8.3 | 40.9 | 24.7 / pending | 87.4 | none observed |
| 3 / high distance, fresh | 0.5 | 253.4 | 286.0 | 26.4 / pending | 308.3 | none observed |
| 4 / high distance, cached | 0.6 | — | 0.9 | 24.3 / ready | 56.5 | none observed |
| 5 / 600 changes, fresh | 0.3 | 176.3 | 228.3 | 24.4 / pending | 269.5 | none observed |
| 6 / 600 changes, cached | 26.9 | — | 27.1 | 69.6 / ready | 84.1 | 69 |
| 7 / high-to-short cancellation | 0.4 | 2.0 (short) | 42.9 | 19.5 / pending | 84.0 | none observed |
| 8 / high distance, fresh | 0.2 | 243.2 | 275.8 | 23.3 / pending | 1272.4 | none observed |
| 9 / high distance, fresh | 0.2 | 244.7 | 276.9 | 23.4 / pending | 303.5 | none observed |

Frame and ready latencies are measured from the initiating click, including
preparation. In particular, the second-frame column is not elapsed time since
ready. Sample 8's 1272.4 ms frame latency is retained; its cause is unassigned,
and its ready time was 275.8 ms. The short-input sample also had a 51 ms long
task. These observations prevent a blanket claim of eliminated long tasks.

For the three high-distance requests, the main thread reached an animation
frame while the result was still pending, and dispatch was short. Completed
computation did not become faster: worker startup/delivery and compute remained
part of the 275.8–286.0 ms ready latency. The 600-row fresh result spent 9.7 ms
in delivery/controller DOM work; cached selection still produced a 69 ms long
task without a worker. Rendering many rows remains an independent limitation.

The cancellation sample recorded the high-distance worker being posted to and
terminated without a delivery, followed by the short request being delivered.
The final source was the short Unicode fixture. This verifies pending-request
cancellation with real workers under the limited immediate-switch procedure
described above, not interruption after confirmed CPU computation began.

The ordinary production example was checked separately from the measurement
harness. Once asynchronous Unicode details became ready, Enter navigation
selected old `[15,17)` and new `[15,16)` for the combining/precomposed accent.
Selecting the shifted nested child produced old `[16,27)` and new `[24,35)`.
Empty-text insertion preserved source strings `''` and `🇨🇦`, with a visibly
sized inline marker. Switching to marked text cleared text highlights, retained
the strong text rendering and showed the unsupported state.

Visibility was recorded at each sample's start, not continuously throughout the
request; no cause is assigned to the frame-latency outlier on that basis.
