import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../lib/store.mjs";

test("handoff requires acknowledgement, is idempotent and has terminal states", () => {
  const store = new Store(":memory:");
  try {
    const first = store.create({ eventKey: "parcel-42", kind: "parcel" });
    const retry = store.create({ eventKey: "parcel-42", kind: "parcel" });
    assert.equal(retry.handoff.id, first.handoff.id);
    assert.equal(retry.duplicate, true);
    assert.equal(store.list().length, 1);
    assert.throws(
      () => store.move(first.handoff.id, "completed"),
      /Cannot move/,
    );
    store.move(first.handoff.id, "acknowledged");
    store.move(first.handoff.id, "completed");
    assert.throws(
      () => store.move(first.handoff.id, "acknowledged"),
      /Cannot move/,
    );
    assert.equal(store.snapshot().history.length, 3);
  } finally {
    store.close();
  }
});

test("overdue arrivals surface once and remain recoverable", () => {
  const store = new Store(":memory:");
  try {
    const { handoff } = store.create({ eventKey: "late", kind: "visitor" });
    assert.equal(store.sweep(Date.parse(handoff.deadline) - 1).length, 0);
    assert.equal(store.sweep(Date.parse(handoff.deadline)).length, 1);
    assert.equal(store.sweep(Date.parse(handoff.deadline) + 1000).length, 0);
    assert.equal(store.get(handoff.id).status, "needs_attention");
    assert.equal(store.move(handoff.id, "acknowledged").status, "acknowledged");
    assert.equal(store.move(handoff.id, "cancelled").status, "cancelled");
    assert.throws(() => store.move(handoff.id, "completed"), /Cannot move/);
  } finally {
    store.close();
  }
});

test("handoffs and preferences survive closing and reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "doorstep-"));
  const path = join(dir, "state.sqlite");
  let store = new Store(path);
  try {
    const { handoff } = store.create({ eventKey: "persist", kind: "parcel" });
    store.setPreferences({ quietMode: false });
    store.move(handoff.id, "acknowledged");
    store.close();
    store = new Store(path);
    assert.equal(store.preferences().quietMode, false);
    assert.equal(store.get(handoff.id).status, "acknowledged");
    assert.equal(store.snapshot().history.length, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
