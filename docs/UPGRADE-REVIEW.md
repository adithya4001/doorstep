# Doorstep 0.2 — approved upgrade walkthrough

The entrant approved the redesigned app and authorized release. Version 0.2 is being aligned across the public source, screenshots and Devpost draft. The public working demo is https://youtu.be/evFmkHwWMFU. No final Devpost entry has been submitted; personal declarations and terms acceptance remain pending.

## Tracks and reasons

| Entry | Decision | Evidence |
| --- | --- | --- |
| Alexa+ primary | Target | Working self-hosted MCP 2025-11-25 over Streamable HTTP; official SDK imported and called; browser performs initialize, discovery and real tool calls |
| Open Source mini challenge | Target | Additional MIT-licensed `doorstep-flow` library, published separately at https://github.com/adithya4001/doorstep-flow; used by the main app; exhaustive transition tests |
| AWS Builder | Excluded for now | Bedrock adapter exists, but no live AWS invocation has been verified |
| Fire TV | Excluded | Browser resident display exists; no Fire OS/Vega/emulator execution evidence |
| Ring | Excluded | Manual arrival input; no Ring API, SDK, official simulator or device runtime integration |
| Bee | Excluded | No real Bee-device or Apple Watch Bee data |

The [official rules](https://amazonappdev2026.devpost.com/rules) permit the self-hosted MCP route. The [FAQ](https://amazonappdev2026.devpost.com/details/faqs) explicitly allows a real browser MCP client and a locally runnable repository plus video. Selecting more categories without the corresponding runtime evidence would weaken the submission's accuracy. These choices do not guarantee eligibility or a prize.

## Design changes

The original green/cream treatment resembled the entrant's Table & Thyme project. Version 0.2 replaces it with an ink-and-blue visual system, sans-serif typography, a top navigation bar, an arrival workspace, a handoff-loop diagram and a separate household pulse panel. Light mode has a pale blue-grey canvas and white panels. The layout, information hierarchy and controls have all changed, rather than only the palette.

The login view has a purpose-built CSS door illustration. The dashboard has no placeholder analytics: open count, confirmed receipts today, overdue count and average arrival-to-receipt time derive from saved data. Demo samples are labelled and use the same tools as real manual entries. An average of zero seconds can occur when an automated demo records and confirms an arrival immediately; it is not a claimed real delivery speed.

## What now works

| Feature | Behavior |
| --- | --- |
| Light, dark and system appearance | Uses CSS variables; browser preference is saved in localStorage; system mode follows the OS |
| Owner setup and sign-in | First owner creates a local account; password hashed with scrypt and a random salt; credentials are never kept in browser storage |
| Sessions and sign-out | Random opaque cookie, server stores its SHA-256 hash, 12-hour expiry, HttpOnly and SameSite=Strict; sign-out revokes the session and clears protected content |
| Login protection | Invalid credentials get a generic error; five failed attempts per IP cause a 15-minute throttle; throttle is process-local |
| Arrival entry | Parcel or visitor, optional note, stable event key for retrying within the open dialog |
| Board controls | Open/attention/received/all filters, search by note/type/ID/status, newest or oldest first |
| Handoff detail | Full saved timeline for one arrival, even if older events have left the latest-50 dashboard feed |
| Validated workflow | Arrival → acknowledged → received; overdue arrivals stay visible; dismissal/cancellation is explicit |
| Household settings | Home label, resident name, instructions and 30–1800 second response window persist in SQLite; old arrival deadlines remain unchanged |
| Resident display | Large visual prompts and controls; arrow keys move focus between actions |
| Activity export | Downloads the latest 50 saved events as CSV with UTC timestamps; handoff notes are not included |
| Guided console | Deterministic supported phrases call real MCP tools; changing a status requires selecting a specific arrival |
| Connection view | Negotiated protocol, eight discovered tools and real request log, placed inside Settings |

Quiet mode is an app preference; this prototype currently produces visual prompts only. It never changes a physical doorbell. The console is not an LLM or a native Alexa connection. Notes are escaped before rendering. No camera, biometric or emergency feature is claimed.

## Try the revised app

Run `start-doorstep.cmd` from the delivered folder, then open http://127.0.0.1:4317. Node.js 24 and npm are required. Existing arrival data remains in `doorstep/data`; authentication tables are created alongside it. The first launch of this version asks you to create the owner even if an older database already contains arrivals. Do this on your own computer before sharing access.

1. Create your own username and password. The screenshots use a synthetic account in an in-memory test database; those test credentials are not your account.
2. Try the labelled demo scenario or add an arrival manually.
3. Open the timeline, acknowledge the arrival and then confirm receipt.
4. Change appearance under Settings, reload and confirm it stays selected.
5. Change the household label and response window. Add another arrival to observe the new deadline.
6. Open Activity and export its CSV. Sign out and sign back in to recover the saved workspace.

For an external MCP client, use your own configured bearer token as described in the README. Browser login works without that token. This is one local household account, not multi-user SaaS authentication. There is no email password recovery or password-change UI. Keep the local database and password private.

## Verification and interview preparation

Ten automated tests passed: eight application/authentication/protocol tests plus two independent library tests. Thirteen real-browser scenarios passed at desktop 1440×1080 and mobile 390×844, with zero page errors. Screenshots are in `doorstep/evidence/v2`; the exact browser result is `browser-checks.json`. Tests use actual loopback HTTP and SQLite without response interception.

Read `PROJECT-GUIDE.md` for the source-file map, request path, state-machine reasoning, database transactions, MCP protocol and interview questions. The key explanation remains: **vachindi → choosaanu → teesukunnaanu** are separate facts. Authentication answers who can use this local workspace; the state machine answers which step is valid. These solve different problems.

Before final submission, confirm the public source and Devpost text/screenshots match the new demo at https://youtu.be/evFmkHwWMFU. The entrant must review the result and personally confirm binding declarations. The official deadline is October 23, 2026, 12:00 PM PDT, which is October 24, 2026, 12:30 AM IST.
