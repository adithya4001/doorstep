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

This reusable library is an additional contribution alongside the [Doorstep application](https://github.com/adithya4001/doorstep), which uses it at runtime. It is MIT licensed and independently usable without a server, browser, database or cloud account. The separate repository provides the contribution URL for the hackathon Open Source mini challenge.
