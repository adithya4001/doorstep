# Before submission

The project is a working local prototype with verified core and browser tests. Public source repositories and a public demo are prepared; final Devpost submission remains subject to the entrant's review and agreement.

## Blocking checks

- [ ] Entrant personally verifies age, residence, conflicts of interest and authority to use any institutional AWS account.
- [ ] Launch from `start-doorstep.cmd` on the normal Windows desktop. Confirm `MCP connected` at `http://127.0.0.1:4317`.
- [x] Run the optional network integration test with `RUN_NETWORK_TESTS=1`. Final run passed.
- [x] Exercise parcel creation, acknowledgement, completion and history in the real local-server browser path; quiet-mode behavior passed integration testing.
- [ ] Restart the server and confirm the same state is restored.
- [x] Publish the complete source tree to https://github.com/adithya4001/doorstep with the root MIT license, excluding dependencies, databases, credentials and private evidence.
- [x] Publish the additional library at https://github.com/adithya4001/doorstep-flow as a separate public contribution.
- [x] Record the real working application and publish the 1:02 English-captioned demo at https://youtu.be/tq_19A4B3_0.
- [x] Replace missing publication links in the submission draft.
- [ ] Submit genuine tool feedback. Add a friction log only for reproducible first-hand observations.
- [ ] Select Alexa+ and only additional tracks or challenges with demonstrated qualifying evidence.
- [ ] Review the final Devpost project page and personally accept its binding submission terms if required.
- [ ] Submit before October 24, 2026 at 12:30 AM IST. Confirm the event entry is submitted, not just saved as a portfolio draft.

## Optional expansion gates

- AWS: local SDK authentication + a successful live Bedrock invocation + honest documented integration and feedback. Do not claim completion from adapter code alone.
- Fire TV: actual Fire TV, Android TV emulator or permitted Fire/Vega simulator execution footage. Browser screenshot alone is insufficient.
- Ring: official API, SDK, documented simulator or device used at runtime. Manual demo arrivals are insufficient.
- Bee: real Bee-device or Apple Watch Bee data shown doing something useful. Synthetic data is insufficient.

## Keep for judging

Keep setup instructions and dependencies reproducible, and the project available to judges through November 20, 2026 under the event rules. A public MIT repository makes access simpler. Keep the submitted release identifiable; do not rewrite event-period commit history or imply work was completed earlier than it was.

## Current verification

See `VERIFICATION.md` for exact checks and limitations. The final browser screenshots were captured against the real local Express server with network MCP requests and no route interception. They are not proof of a live Ring, Alexa device, AWS account or Fire TV integration.
