export const transitions = Object.freeze({
  waiting: ["acknowledged", "needs_attention", "cancelled"],
  needs_attention: ["acknowledged", "cancelled"],
  acknowledged: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
});

export function moveHandoff(current, next, at = new Date().toISOString()) {
  if (!transitions[current.status]?.includes(next)) {
    throw new Error(`Cannot move a handoff from ${current.status} to ${next}.`);
  }
  return { ...current, status: next, updatedAt: at };
}

export function needsAttention(handoff, now = Date.now()) {
  return handoff.status === "waiting" && now >= Date.parse(handoff.deadline);
}

export function publicHandoff(handoff) {
  const { id, kind, status, createdAt, updatedAt, deadline, source } = handoff;
  return { id, kind, status, createdAt, updatedAt, deadline, source };
}
