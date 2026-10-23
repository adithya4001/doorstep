# Verification record

## Current local version 0.2

Public core/test revision `63c5221573fc1448bc3b8024b3da962fa4310318` was independently downloaded and installed with npm ci. All ten tests passed with network checks enabled. GitHub Actions also passed: https://github.com/adithya4001/doorstep/actions/runs/39940073593.

Ten automated tests passed on October 23, 2026 with `RUN_NETWORK_TESTS=1`: eight application/authentication/protocol tests and two independent library tests. None were skipped. This includes the official SDK client connecting to the protected real HTTP listener, owner setup/login, cookie flags, missing-session rejection, missing/foreign-Origin rejection, logout revocation, session expiry, password throttling, preference validation, unchanged existing deadlines and full history beyond the latest-50 feed.

Thirteen real-Chrome browser scenarios passed without response interception, with zero captured page errors. Desktop viewport: 1440×1080. Mobile: 390×844, no horizontal document overflow. Scenarios cover setup, HttpOnly session, labelled samples, search, timeline acknowledgement/completion, saved settings, light-theme persistence after reload, escaped notes, CSV download, console target selection, overdue filter, sign-out clearing and successful re-login after an incorrect password.

Screenshots under `doorstep/evidence/v2` show the redesigned interface against the actual Express server and SQLite database. `browser-checks.json` records scenario results. The synthetic review account lived only in the in-memory test database; it is not an entrant credential. Screenshots have been visually inspected in dark/light desktop and mobile sizes.

The revised public demo is https://youtu.be/evFmkHwWMFU (103.33 seconds, 1440×1080, English captions). All 310 encoded frames decoded successfully; the real-server recording captured no browser page errors. The source update is published in successive browser commits. Final Devpost submission remains pending. Live AWS, Ring, Bee and native Alexa/Fire TV execution, user research, production security, performance/load testing and accessibility certification remain unverified.

## Historical version 0.1 checks

The remainder of this record describes the earlier build, preserved for provenance. Tool counts, screenshots and browser labels below do not describe 0.2.

Initial verification date: October 23, 2026.

## Passed

- Workflow: invalid completion rejected, duplicate arrival returns original ID, terminal state cannot be reopened, transition history matches successful actions.
- Timeout: boundary behavior, one-time attention transition, recovery from attention and cancellation.
- Persistence: reopen the same SQLite file and recover preferences, handoff status and history.
- Protocol: official MCP SDK client connects to SDK Web Standard server transport through actual HTTP Request/Response objects; version 2025-11-25 is negotiated; six tools discovered; invalid tool input rejected; multi-step completion works.
- Reusable library: every permitted state edge works; every forbidden edge is rejected without input mutation; attention deadline boundary and public projection omit private note/event-key fields.
- Browser: application initialization, parcel creation, resident acknowledgement, receipt confirmation, home status chat, protocol view and missing-Bedrock error handling.
- Layout: desktop 1440 × 1120 and mobile 390 × 844, no horizontal document overflow at the tested mobile size. Screenshots visually inspected.
- Browser page-error capture: zero errors in the completed workflow run.

Final application/protocol suite: **5 passed, 0 skipped** with `RUN_NETWORK_TESTS=1`. Library suite: **2 passed**. Final browser workflow passed against the real server at `http://127.0.0.1:4319`, without route interception. Seven automated test cases passed in total.

## Not passed or not yet verified

- Cross-context preview: initial attempts to reach a listener from a different managed execution context failed. The final listener and browser ran together and the real network workflow passed. The normal desktop launcher remains available for entrant review.
- Live AWS Bedrock call: no account authentication or live invocation performed.
- Ring, Bee, native Alexa tooling or device, Fire TV/Vega/Android TV emulator: not integrated or tested.
- Public submission video, repository publication and Devpost final submission: separate release tasks; inspect their live state before making completion claims.
- User research, production security, accessibility certification and performance/load testing: not performed.

## Screenshot provenance

The final screenshots under `doorstep/evidence` show the application rendered in Chrome against the real Express listener on localhost, using actual HTTP MCP requests and SQLite state changes. The initial in-process screenshots were replaced after live browser verification succeeded. `browser-verification.json` records the final result. No responses were intercepted in that final run.

`overview.png` shows the initial state; `resident.png` shows acknowledged handoff instructions; `protocol.png` shows version and tool requests; `mobile.png` shows the responsive completed-handoff state. They are browser screenshots, not device screenshots.

## Dependency versions installed

Node.js 24.19.0. MCP SDK 1.32.1, Express 5.3.0, Zod 3.25.76, AWS Bedrock Runtime SDK 3.1156.0. Exact dependency resolution is committed in `doorstep/package-lock.json`.
