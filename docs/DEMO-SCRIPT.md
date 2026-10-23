# English demonstration script

Target duration: 2 minutes 35 seconds. Record the real running application after the localhost release check succeeds. Use your own voice. There is no need for copyrighted music, stock footage or third-party logos.

## Before recording

Start the app and open `http://127.0.0.1:4317`. Use synthetic household data. Confirm the status says MCP connected. If you need a clean demo database, stop the server first and move `doorstep/data` to a backup folder rather than deleting real data. Start again. Do not claim the browser is a Fire TV simulator.

## 0:00–0:18 — Problem and product

Screen: household overview.

Say: “A doorbell tells you someone arrived. It does not tell you whether the person inside noticed, or whether the handoff finished. Doorstep keeps those moments separate, with a visible prompt that stays until the resident responds.”

## 0:18–0:40 — Record an arrival

Screen: click **Try a parcel handoff**.

Say: “This is a manually entered demo arrival. The household now has one open handoff. I’m not claiming a camera or Ring feed is connected. The arrival is saved on the backend with a unique event key, so retrying the same event does not create another delivery.”

## 0:40–1:04 — Resident acknowledgement

Screen: select **Resident display**, use a keyboard to focus **I've seen it**, press Enter.

Say: “The resident gets a large, persistent visual prompt. Acknowledging it is separate from receiving the parcel. Now the saved handoff instructions are visible. Nothing unlocks, and these instructions are not automatically sent to a visitor.”

## 1:04–1:24 — Shared conversation and completion

Screen: return to overview. Click **Check my home**. Type **The parcel is received** and send it.

Say: “The conversation and display use the same persistent state. This local simulator uses explicit intent shortcuts. It makes real MCP tool calls. When I confirm receipt, the server validates the transition and marks the handoff complete.”

## 1:24–1:45 — Protocol evidence

Screen: open **Connection details**, show version 2025-11-25 and the tool request log.

Say: “The self-hosted server uses the official MCP SDK over Streamable HTTP. This browser initializes the connection, discovers six tools and calls them. The same endpoint can be used by another compatible MCP client. This is our own simulator, not Amazon’s gated Alexa+ toolkit.”

## 1:45–2:05 — History and recovery

Screen: show handoff history. Restart the local server while recording if practical; refresh and show the saved history.

Say: “SQLite keeps the workflow and its history across restarts. An unacknowledged arrival becomes an attention item after two minutes. That attention queue is local to the app; it does not pretend a caregiver was contacted.”

Only demonstrate restart if the real action succeeds. If the restart is omitted, shorten this section and mention persistence as a tested property, not as footage you showed.

## 2:05–2:25 — Open Source contribution

Screen: show the real published `doorstep-flow` repository, its license and transition tests. Omit this segment if it has not been published.

Say: “We also published the handoff state machine as a separate MIT library. It rejects completion before acknowledgement, prevents transitions out of terminal states and includes exhaustive transition tests. Other developers can reuse it without the Doorstep interface.”

## 2:25–2:35 — Close

Screen: return to overview or resident display.

Say: “Doorstep makes the next step clear, without turning an arrival into an assumption. A quieter arrival, and a clearer handoff.”

## Upload

Export under three minutes. Upload to YouTube or Vimeo with public visibility. Confirm the URL works while signed out and that the video shows the actual app. Copy it into Devpost. A local recording or unlisted/private upload does not satisfy the stated public-video requirement.
