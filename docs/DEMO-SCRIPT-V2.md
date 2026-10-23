# Doorstep 0.2 recording plan

The revised public recording is https://youtu.be/evFmkHwWMFU. It contains 103.33 seconds of working-app footage with English captions, below the official 3-minute limit. The table below remains the longer narration plan; the published capture follows the same core workflow.

Use only synthetic data. Create the owner before recording so no password appears in footage; show the signed-in state and explain it. Do not show bearer tokens, AWS credentials, personal browser tabs or real household notes. Keep both `doorstep` and `doorstep-flow` folders together when running the app.

| Time | Screen and action | Narration |
| --- | --- | --- |
| 0:00–0:15 | Overview with an empty board | “Arriving, being seen and being received are different moments. Doorstep keeps a visible next step until a resident confirms it. This is a local household prototype with manually recorded arrivals.” |
| 0:15–0:40 | New arrival → parcel, synthetic note → record | “This button calls a real MCP tool over Streamable HTTP. An idempotency key prevents a retry from creating another copy of the same arrival. The open count comes from the saved record.” |
| 0:40–1:05 | Open handoff timeline → acknowledge → Resident display → received | “The server rejects completion before acknowledgement. The large resident view keeps the arrival visible; only an explicit receipt confirmation completes it. Every successful transition is saved in SQLite.” |
| 1:05–1:25 | Add visitor → search → filters → Activity | “Search and filters help when several handoffs are open. Each arrival has its full timeline, and the latest 50 events can be exported.” |
| 1:25–1:45 | Settings → household preferences → switch light/dark | “Household instructions and response windows persist on the server. Appearance stays on this browser. A local owner account uses hashed passwords and server sessions. This is one household, not a production identity platform.” |
| 1:45–2:05 | Guided console → select arrival → I’ve seen it; then expand connection details | “These published command shortcuts make real MCP calls. The browser negotiates protocol 2025-11-25 and discovers eight tools. It requires a selected arrival before a status change. This is our own front end; no native Alexa device or language model is connected.” |
| 2:05–2:20 | Show library repository/source and return to overview | “The separate MIT library, doorstep-flow, enforces the transitions and deadline rules. Ten automated tests and thirteen browser scenarios passed. Our target entries are Alexa+ through the self-hosted MCP route and the Open Source mini challenge.” |

If demonstrating the attention queue, set the future-arrival window to 30 seconds in Settings, record a new arrival and wait naturally. Do not claim externally delivered alerts, physical doorbell control, Ring, Bee, Fire TV or a verified AWS runtime. Product feedback must describe actual observations. Record the final approved build and align source, screenshots, text and the public video before submission.
