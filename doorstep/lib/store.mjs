import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { moveHandoff, needsAttention } from "../../doorstep-flow/index.mjs";

export class Store {
  constructor(path = "data/doorstep.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, event_key TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (sequence INTEGER PRIMARY KEY AUTOINCREMENT, handoff_id TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);`);
    this.db.prepare("INSERT OR IGNORE INTO preferences VALUES (1, ?)").run(
      JSON.stringify({
        resident: "Amma",
        quietMode: true,
        instructions:
          "Leave parcels on the bench beside the door. Please do not ring again.",
        acknowledgementSeconds: 120,
      }),
    );
  }

  preferences() {
    return JSON.parse(
      this.db.prepare("SELECT payload FROM preferences WHERE id=1").get()
        .payload,
    );
  }

  setPreferences(input) {
    const next = { ...this.preferences(), ...input };
    this.db
      .prepare("UPDATE preferences SET payload=? WHERE id=1")
      .run(JSON.stringify(next));
    return next;
  }

  record(id, action) {
    this.db
      .prepare("INSERT INTO history (handoff_id,action,at) VALUES (?,?,?)")
      .run(id, action, new Date().toISOString());
  }

  atomic(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  create({ eventKey, kind, note = "" }) {
    return this.atomic(() => {
      const existing = this.db
        .prepare("SELECT payload FROM handoffs WHERE event_key=?")
        .get(eventKey);
      if (existing)
        return { handoff: JSON.parse(existing.payload), duplicate: true };
      const now = new Date();
      const handoff = {
        id: randomUUID(),
        kind,
        note,
        source: "manual-demo",
        status: "waiting",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        deadline: new Date(
          now.getTime() + this.preferences().acknowledgementSeconds * 1000,
        ).toISOString(),
      };
      this.db
        .prepare("INSERT INTO handoffs VALUES (?,?,?)")
        .run(handoff.id, eventKey, JSON.stringify(handoff));
      this.record(handoff.id, "Arrival recorded · waiting for resident");
      return { handoff, duplicate: false };
    });
  }

  list() {
    return this.db
      .prepare("SELECT payload FROM handoffs ORDER BY rowid DESC")
      .all()
      .map((row) => JSON.parse(row.payload));
  }

  get(id) {
    const row = this.db
      .prepare("SELECT payload FROM handoffs WHERE id=?")
      .get(id);
    if (!row) throw new Error("That handoff could not be found.");
    return JSON.parse(row.payload);
  }

  move(id, status) {
    return this.atomic(() => {
      const next = moveHandoff(this.get(id), status);
      this.db
        .prepare("UPDATE handoffs SET payload=? WHERE id=?")
        .run(JSON.stringify(next), id);
      this.record(
        id,
        {
          acknowledged: "Resident acknowledged the arrival",
          completed: "Resident confirmed the handoff is complete",
          cancelled: "Resident cancelled the handoff",
          needs_attention:
            "No acknowledgement yet · needs attention in this app",
        }[status],
      );
      return next;
    });
  }

  sweep(now = Date.now()) {
    return this.list()
      .filter((item) => needsAttention(item, now))
      .map((item) => this.move(item.id, "needs_attention"));
  }

  snapshot() {
    this.sweep();
    return {
      preferences: this.preferences(),
      handoffs: this.list(),
      history: this.db
        .prepare("SELECT * FROM history ORDER BY sequence DESC LIMIT 50")
        .all(),
    };
  }

  close() {
    this.db.close();
  }
}
