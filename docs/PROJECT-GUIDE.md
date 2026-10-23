# Know Doorstep well enough to defend it

This guide explains the implementation that exists today. Use it to build your own understanding and make changes yourself before presenting. Do not claim unbuilt integrations or memorized test results as personal experience.

## Your 30-second explanation

“Doorstep is a household handoff prototype. It separates someone arriving, the resident acknowledging that arrival, and the resident confirming receipt. A visible prompt, a conversation interface and an MCP tool server share one SQLite-backed state. I used explicit state transitions and idempotency keys so an assistant or retried request cannot silently mark a delivery complete. The current demo records arrivals manually. The MCP interface is real; Ring and native Alexa connections are not implemented.”

Telugu memory cue: **vachindi → choosaanu → teesukunnaanu**. Ee moodu okate event kaavu. Project core idea ade.

## Follow one request from click to database

1. The signed-in owner clicks **New arrival**, chooses parcel or visitor and submits the optional note.
2. `public/app.js` creates a unique event key when the dialog opens and invokes the `record_arrival` MCP tool on submission. A retry within the same dialog reuses that key.
3. Its `rpc()` function sends a JSON-RPC request to `/mcp` with the protocol headers. JSON-RPC carries the method name, request ID and parameters.
4. `server.mjs` checks Host and Origin, parses a bounded JSON body, verifies an owner session or configured bearer token, and passes the call to the official SDK's Streamable HTTP transport.
5. `lib/mcp.mjs` registers the tool with a Zod schema. The SDK validates that `kind` is parcel or visitor and `eventKey` is a bounded nonempty string.
6. The tool invokes `Store.create()` in `lib/store.mjs`.
7. A SQLite transaction checks the event key, inserts a new handoff when needed and records the first history entry. A duplicate event key returns the original handoff.
8. The tool returns both text and structured JSON. The browser refreshes the shared snapshot and renders the prompt.

The browser is the client; the Express process is the server; SQLite is the database. MCP is the structured interface between a compatible assistant/client and the application's tools. MCP itself does not make a model intelligent.

## What every source file does

| File | Responsibility |
| --- | --- |
| `doorstep/server.mjs` | Builds the Express app, enforces local Host/Origin restrictions, exposes health/MCP/summary routes, serves assets, starts the timeout sweep and handles shutdown |
| `doorstep/lib/mcp.mjs` | Registers eight tools with schemas, descriptions and annotations; converts domain errors into tool error results |
| `doorstep/lib/auth.mjs` | Creates one owner, derives salted scrypt hashes, issues hashed opaque sessions, checks expiry, revokes sessions and throttles invalid login attempts |
| `doorstep/lib/store.mjs` | Opens SQLite, creates tables, stores preferences, creates/deduplicates arrivals, moves states transactionally, records history and finds overdue work |
| `doorstep/lib/bedrock.mjs` | Optional SDK Converse request using a minimized snapshot; no model-driven mutation |
| `doorstep/public/index.html` | Semantic page structure, navigation, resident panel, chat, history and connection views |
| `doorstep/public/style.css` | Responsive design, focus states, large resident controls and reduced-motion behavior; original door illustration is CSS |
| `doorstep/public/app.js` | Browser MCP client, rendering, deterministic chat shortcuts, button handlers, polling, messages and error feedback |
| `doorstep-flow/index.mjs` | Reusable allowed transitions, deadline detection and public-field projection |
| `doorstep/test/workflow.test.mjs` | Workflow invariants, retries, deadlines, cancellation and database restart tests |
| `doorstep/test/protocol.test.mjs` | Official SDK client/server tested through HTTP Request/Response objects without a network socket |
| `doorstep/test/mcp.test.mjs` | Opt-in real local-socket integration check, including origin rejection and method handling |
| `doorstep/test/auth.test.mjs` | Password/session lifecycle, expiry, throttling, protected real MCP access, preference validation and full historical detail |
| `doorstep-flow/test/flow.test.mjs` | Exhaustive state-edge checks and privacy projection behavior |
| `package-lock.json` | Locks resolved package versions for reproducible `npm ci` installs |

## The state machine

```text
waiting ───────────────→ acknowledged ─────────→ completed
   │                           │
   ├→ needs_attention ─────────┘
   │         │                 │
   └─────────┴─────────────────┴──────────────→ cancelled
```

Only the edges in `transitions` are legal. `moveHandoff()` checks the current status, rejects an illegal next status and returns a new object. It does not mutate the input. Completed and cancelled are terminal states.

The state machine is a business invariant, not a security boundary. The server has one local household owner account; MCP actions require its session or a configured bearer token. In a deployed multi-household product, every action must additionally verify household membership and authorization.

**Why reject waiting → completed?** Seeing an arrival and receiving it are separate assertions. A notification being displayed is not evidence of receipt. The backend enforces this even when a client is buggy or an assistant asks for the wrong tool.

**Why keep acknowledgement separate from instructions?** The instructions are household preferences. They are displayed after acknowledgement; the app does not claim they were delivered to the visitor.

## Data and transactions

SQLite stores five tables:

- `handoffs`: one ID, one unique event key and a JSON payload per arrival.
- `history`: an incrementing sequence, handoff ID, transition description and timestamp.
- `preferences`: one household's resident label, quiet mode, instructions and acknowledgement timeout.
- `owner`: one normalized username, random salt and scrypt-derived password hash.
- `sessions`: SHA-256 hashes of random opaque tokens and their expiry timestamps. Raw session tokens only travel in the HttpOnly cookie.

`BEGIN IMMEDIATE` starts a write transaction. A successful operation commits. An error rolls back. This prevents the database from retaining a state update without its corresponding history entry, or vice versa.

The unique event-key constraint is the final deduplication guard. The explicit lookup also lets us return the previous result pleasantly. An arrival event key should remain stable across retries of the *same* event. Each fresh demo button click intentionally generates a new event key and represents a new arrival.

Retries of acknowledgement/completion are not treated as no-ops; an already-completed transition returns an error. This is why their MCP annotations do not claim idempotency. If a request loses its response, inspect `home_status` before retrying.

WAL mode supports practical local read/write behavior. The API uses synchronous SQLite methods, so a database operation blocks Node's event loop briefly. That is a conscious small-prototype choice, not a high-throughput architecture. A larger system would use stronger relational modeling, migrations, per-household authorization and a suitable asynchronous persistence layer.

JSON payloads simplify iteration but make database-level querying and constraints weaker. A production schema should model important status/time/household fields directly and version its migrations.

## Timeouts and persistence

An arrival gets a deadline based on the saved acknowledgement window, which defaults to 120 seconds. `needsAttention()` returns true only for a waiting handoff at or after that deadline. `sweep()` moves it once to `needs_attention` and records the change.

The running server sweeps every second. Reading a snapshot also sweeps, so overdue work is caught after a server restart. This is a visible local attention queue, not a delivered SMS, push notification or caregiver escalation.

Timestamps are UTC ISO strings; the browser displays local clock time. The prototype trusts the server clock. There is no distributed scheduler, clock synchronization guarantee or emergency-response guarantee.

## MCP in plain English

The client first sends `initialize`, proposes a protocol version and supplies its capabilities. The server responds with the negotiated version and server details. The client sends `notifications/initialized`, lists the tools and then calls a tool by name with validated arguments.

The browser sends these requests over HTTP POST to `/mcp`. It accepts JSON and event-stream responses, while this server uses the SDK's JSON response mode. Streamable HTTP does not mean every response must be SSE. The server rejects GET/DELETE because it runs without persistent MCP sessions or an SSE subscription stream.

Stateless transport does not mean stateless product. Each HTTP request gets a new SDK server/transport object, while the shared Store persists the household workflow in SQLite. Conversation history in the browser is temporary, but handoff state survives the process restarting.

`home_status` reads the snapshot. `record_arrival` creates one. `acknowledge_arrival`, `complete_handoff` and `cancel_handoff` move it. `set_quiet_mode` changes the local preference. `household_preferences` validates and saves household details; existing deadlines are unchanged. `handoff_details` reads one arrival and its full saved timeline, beyond the dashboard's latest-50 feed. Zod validates external argument shapes before handlers run; domain functions enforce valid state changes afterward.

Tool annotations tell clients about behavior but do not enforce permissions. The tool descriptions request explicit resident confirmation; an authorized external client could ignore that wording. The server requires a household session or bearer token, but delegated consent and granular tool permissions are not implemented.

## Browser behavior

`render()` derives visible counts, cards and resident content from a backend snapshot. It escapes dynamic values before placing them in HTML. Chat messages use `textContent`, which avoids interpreting them as HTML. The UI polls every 2.5 seconds and refreshes after actions.

The `busy` guard prevents overlapping writes from this browser. It is not a distributed lock. SQLite and transition checks protect backend consistency if another client also sends requests.

The guided console uses anchored regular-expression shortcuts, not a model. It recognizes a few published phrases. It requires a specific arrival selection before acknowledging or completing it, so it cannot silently choose the most recent matching arrival. This is reproducible but is not open-ended language understanding. Cards also target their own IDs.

Themes use CSS variables. Only the appearance preference is saved in browser localStorage; system mode follows `matchMedia`. Household settings are server-side preferences. Search/filter/sort operate on the current snapshot. Dashboard averages derive from today's completed records, never invented analytics. Native dialogs provide modal focus behavior. CSV export contains the latest 50 system-written events, not notes.

## Authentication request path

First launch calls `/api/auth/status`. If no owner exists, `/api/auth/setup` validates the username and 12–128 character password, derives a 64-byte key with asynchronous scrypt and a random 16-byte salt, and inserts the sole owner. A simultaneous second setup is rejected by the database constraint. Login derives the candidate hash, compares it with `timingSafeEqual`, and uses a generic failure message. Five failed attempts from one IP trigger a 15-minute process-local throttle.

The server issues a random 32-byte session token and stores only its SHA-256 hash with a 12-hour expiry. The browser receives an HttpOnly, SameSite=Strict cookie. On protected requests the server hashes that cookie and verifies its stored expiry. Cookie-based writes require an allowed Origin. Logout deletes the session. Browser code clears protected content. HTTPS requests also receive the Secure cookie attribute; this prototype's supported loopback URL is HTTP.

External compatible clients can use a separately configured bearer secret of at least 32 characters. This grants access to the one household, including writes. It is not OAuth or fine-grained delegation. `DOORSTEP_AUTH=off` is an explicit trusted-local-demo escape hatch, not the default. There is no password recovery, password-change UI or multi-account model. First-owner enrollment assumes the app is running on the owner's trusted computer.

The resident display offers large buttons, keyboard controls and visible focus. It has not been tested with intended users or certified for accessibility. The browser preview does not establish native Fire TV support.

## Optional Bedrock integration

`BedrockRuntimeClient` uses the normal AWS SDK credential chain. Credentials stay on the server. `ConverseCommand` receives a constrained system instruction and only aggregate handoff kind/status plus quiet mode. It has a token limit, timeout and bounded retry count.

The summary response cannot call tools or mutate state. The code handles missing configuration and failed service calls visibly. No live invocation was verified in the initial build. An implemented adapter is different from an operational cloud integration.

## Security and privacy: what to say accurately

The listener binds to loopback and restricts browser Origins and Host values to reduce cross-site requests and DNS-rebinding exposure. It bounds JSON input, sets a content-security policy, avoids third-party scripts and keeps raw passwords/session tokens out of JavaScript storage. Owner authentication protects app API access. These controls have been tested for the local prototype; they do not constitute a production security review.

The database is not encrypted at rest. A person with local filesystem access may read it. There is no multi-household isolation, retention policy, email recovery or hardened remote enrollment. Do not expose the listener publicly. No face recognition, camera ingestion, door unlocking or emergency decisions are implemented.

## Evidence, not adjectives

Version 0.2 checks passed eight application/authentication/protocol cases and two library cases, including authenticated real-socket integration with `RUN_NETWORK_TESTS=1`. Thirteen browser scenarios passed against the actual Express listener on localhost without route interception and with zero captured page errors. Screenshots and `browser-checks.json` are under `doorstep/evidence/v2`. The listener and browser ran in the same permitted execution context.

Do not say “flawless”, “production-ready”, “fully accessible”, “proven to help seniors” or “all integrations tested”. State what was tested and name the limitation. This makes your engineering explanation stronger.

## Questions an interviewer may ask

**Why a state machine instead of booleans?** Independent booleans permit contradictory combinations. A finite set of states with explicit edges makes valid behavior easy to inspect and exhaustively test.

**How do retries avoid duplicate work?** A stable event key and a unique database constraint identify the same arrival. The transaction returns its original result on a retry.

**What if the process crashes?** SQLite commits or rolls back the transaction. On restart, the app reopens the same file; snapshot reads recover overdue waiting items. External side effects are absent today. If notifications are added later, an outbox pattern would be worth evaluating.

**What is the hardest missing production piece?** Multi-person identity and delegated consent across households, plus reliable input from a real device source. The local owner account is a useful first step; tool descriptions alone cannot enforce granular permissions.

**What would you change for scale?** Normalize key fields, add per-household authorization and migrations, move long work out of synchronous request handlers, implement durable job processing and use a database suited to the deployment. Measure before claiming a throughput target.

**Why not enter every track?** Each track requires distinct runtime evidence. A browser view does not prove Fire TV operation, manual events are not Ring integration, and synthetic data does not satisfy Bee. The current strongest honest route is Alexa+ MCP with an additional reusable Open Source contribution after publication.

**Is it AI-generated?** “I used AI assistance and reviewed the implementation. I can explain its behavior and tradeoffs, demonstrate the tests and change the code.” Then demonstrate that understanding. Do not claim human-only authorship.

## Practice by changing the project

1. Change the default acknowledgement window to 90 seconds. Explain why changing a preference does not rewrite already-created deadlines.
2. Add a test showing two distinct event keys create two handoffs.
3. Add a new explicit read-only tool that returns only open handoff counts.
4. Explain why user identity must be checked on the server before allowing remote clients.
5. Draw the request path and state machine without looking at this guide.

Nee confidence ki best shortcut: code ni own words lo explain chesi, small changes chesi, tests run cheyyadam. Script memorize cheyyadam kanna, ee invariants artham chesukovadam mukhyam.
