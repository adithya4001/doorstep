# Verification record

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
