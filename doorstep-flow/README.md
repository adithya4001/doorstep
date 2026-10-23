# doorstep-flow

A dependency-free handoff state machine. Built for workflows where seeing a notification and receiving a handoff are different events.

## Usage

```js
import { moveHandoff, needsAttention, publicHandoff } from './index.mjs';

const waiting = { id: 'parcel-1', status: 'waiting', deadline: new Date(Date.now() + 120000).toISOString() };
const acknowledged = moveHandoff(waiting, 'acknowledged');
const completed = moveHandoff(acknowledged, 'completed');
```

`moveHandoff` returns a new object and rejects invalid edges. `needsAttention` returns true when a waiting handoff reaches its deadline. `publicHandoff` projects an allowlist of fields and omits notes and private event identifiers.

```text
waiting → acknowledged → completed
waiting → needs_attention → acknowledged
waiting / needs_attention / acknowledged → cancelled
```

Completed and cancelled are terminal. The caller is responsible for authorization, storage, notifications, time validation and consent. This library does not verify that a real delivery occurred.

Run tests with Node.js 24: `npm test`.

## Open Source contribution

This is intended as an additional reusable contribution alongside the Doorstep application. Publish this directory as a separate public repository with its MIT license, retain the event-period commit timestamp, and provide its URL and the main project URL in the submission. A local folder alone is not a completed Open Source challenge entry. Do not backdate commits or invent publication evidence.
