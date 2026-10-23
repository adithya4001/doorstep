# Doorstep

**Tagline:** A quieter arrival. A clearer handoff.

**Status:** Review draft. Replace the missing publication links and finish the release checklist before submitting. This document does not represent a completed Devpost submission.

## Inspiration

A doorbell tells you someone arrived. It does not tell a household whether the arrival was seen, whether someone is handling it, or whether the handoff finished. That gap matters when someone misses a sound alert, needs extra time, or wants fewer interruptions.

We wanted to separate three moments that are often treated as one: an arrival, an acknowledgement, and a completed handoff. Our initial audience is households that benefit from visible, persistent prompts. This is a product hypothesis, not a claim backed by user studies.

## What it does

Doorstep gives a parcel or visitor arrival a small, explicit workflow. A prompt stays on the resident display until it is acknowledged. Saved instructions then appear, and the resident confirms when the handoff is finished. If acknowledgement does not arrive within the configured window, the item stays visible in an attention queue.

A household overview, a large-text resident display and a short conversation interface all operate on the same persistent state. The conversation can check the home, record an arrival, adjust quiet mode, acknowledge an arrival and confirm receipt. Its local intent shortcuts are deliberately limited and visible. A compatible external MCP client can discover and call the same tools.

The demo uses manually entered arrivals. It does not connect to Ring, unlock doors, send visitor instructions, notify caregivers, or detect emergencies. Quiet mode changes this app's presentation, not a physical doorbell.

## How it works

The application uses Node.js, Express, SQLite and the official Model Context Protocol TypeScript SDK. Its self-hosted server exposes six validated tools over Streamable HTTP with protocol version 2025-11-25. The browser performs real initialization, tool discovery and tool calls; it is not a prerecorded conversation.

A separate, reusable `doorstep-flow` library defines allowed transitions. SQLite transactions keep the handoff state and history together. Event keys make arrival retries idempotent, preventing the same event from producing duplicate handoffs. The database survives server restarts.

Our protocol tests use an official MCP client against both the SDK's HTTP Request/Response transport and a real local HTTP listener. State-machine tests cover every permitted and rejected transition, acknowledgement deadlines, terminal states, redaction and persistent storage. Seven automated test cases passed. Final browser checks exercised the resident workflow against the real local server at desktop and mobile sizes, without route interception and without page errors.

An optional Bedrock adapter generates a status summary from a minimized aggregate snapshot. That integration is implemented but has not been tested with live AWS credentials; it is not part of the verified primary demo yet.

## What makes the approach useful

The acknowledgement is a first-class state. Doorstep does not infer that a parcel was received merely because a notification was displayed. A compatible assistant can participate in a longer workflow while the server remains responsible for valid transitions. The same transition rules are available to other developers as a small, dependency-free contribution.

## Challenges

The Alexa+ partner tooling is not available to hackathon entrants, so we used the permitted self-hosted MCP path with our own browser client. We also kept simulation boundaries explicit: manually entered arrivals are labeled, browser preview is not presented as a Fire TV device, and optional AWS code is distinguished from a verified cloud integration.

The development environment initially blocked local loopback connections between separate managed execution contexts. We first verified HTTP Request/Response transport in-process, then ran the listener and browser together and successfully verified the real local-server workflow. The demonstration was captured from that working network path.

## What is next

First, validate the product with people who benefit from visible arrival prompts. Then add an authenticated, consent-aware household model and a documented Ring event source, preserving the distinction between an incoming event and a confirmed handoff. Fire TV requires native-device or emulator validation before it is claimed as supported.

## Track selections

- Primary target: Alexa+ — self-hosted MCP server, demonstrated through our own browser client.
- Additional target after publication: Open Source — the separate `doorstep-flow` library.
- AWS Builder: select only after a genuine live integration test and service feedback.
- Fire TV, Ring and Bee: do not select for the current implementation.

## Links and form fields

| Field | Value |
| --- | --- |
| GitHub username | adithya4001 |
| Team | Solo |
| Project repository | https://github.com/adithya4001/doorstep |
| Public English demo under 3 minutes | https://youtu.be/tq_19A4B3_0 — public, 1:02, English captions |
| Open Source contribution URL | https://github.com/adithya4001/doorstep-flow |
| Prior project | Newly built for this hackathon; confirm this remains true for the final submitted work |
| AI assistance | Developed with AI assistance; entrant review and understanding required. Complete any organizer disclosure fields truthfully |

## Product feedback draft

**Tools used:** The official MCP SDK supplies tool registration, schema validation, protocol negotiation and HTTP transport. The browser is our own client. We did not use Amazon's gated Alexa+ toolkit or connect to an Alexa device.

**What worked well:** The SDK's client and server could exercise the workflow through shared standard HTTP interfaces. Structured tool results kept the interface consistent with the backend, and schema validation rejected invalid arrival types.

**What needs work:** The hackathon's permitted self-hosted path and the restricted partner-tooling path need to remain easy to distinguish in onboarding. The event FAQ clarified that a real browser MCP client is an accepted demonstration route. This is an onboarding observation, not a claimed runtime defect in Amazon's tooling.

**Onboarding:** We followed the event resources and MCP documentation, built a server and browser client, and tested protocol negotiation. Our environment's loopback policy interrupted socket testing; that is a local environment limitation.

**Would we use it again?** Yes, for a structured assistant interface where persistent application state and explicit user actions matter. Device connection, identity and authorization would need additional work before deployment.

**AWS feedback:** Do not submit first-hand claims until a real AWS invocation succeeds. If it does, add the exact service, model, integration purpose, onboarding result and observed limitations here.

## Optional friction log

No fabricated entries. The local socket policy is not an Amazon API defect. Add entries only for issues actually encountered while following the relevant developer tools, with reproducible steps, expected and actual outcomes, severity, workaround and an actionable suggestion.
