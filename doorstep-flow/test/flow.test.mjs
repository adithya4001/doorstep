import test from "node:test";
import assert from "node:assert/strict";
import {
  moveHandoff,
  needsAttention,
  publicHandoff,
  transitions,
} from "../index.mjs";

test("every permitted edge works and every other edge is rejected without mutation", () => {
  for (const [status, allowed] of Object.entries(transitions)) {
    for (const next of Object.keys(transitions)) {
      const item = { id: "one", status };
      if (allowed.includes(next))
        assert.equal(moveHandoff(item, next).status, next);
      else assert.throws(() => moveHandoff(item, next));
      assert.equal(item.status, status);
    }
  }
});

test("attention boundary and public projection omit private notes", () => {
  const item = {
    id: "one",
    status: "waiting",
    deadline: "2026-10-23T10:00:00Z",
    note: "Private household note",
    eventKey: "private-key",
  };
  assert.equal(needsAttention(item, Date.parse(item.deadline) - 1), false);
  assert.equal(needsAttention(item, Date.parse(item.deadline)), true);
  assert.equal(
    needsAttention({ ...item, status: "completed" }, Infinity),
    false,
  );
  assert.equal("note" in publicHandoff(item), false);
  assert.equal("eventKey" in publicHandoff(item), false);
});
