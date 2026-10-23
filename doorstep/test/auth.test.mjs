import test from "node:test";
import assert from "node:assert/strict";
import { Auth, bearerMatches } from "../lib/auth.mjs";
import { Store } from "../lib/store.mjs";
import { createApp } from "../server.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("owner setup, hashed credentials, session revocation and expiry", async () => {
  const store = new Store(":memory:");
  try {
    const auth = new Auth(store.db);
    await assert.rejects(auth.setup("owner", "short"));
    const token = await auth.setup("Review.Owner", "fictional-review-password");
    assert.deepEqual(auth.user(token), { username: "review.owner" });
    const row = store.db.prepare("SELECT * FROM owner").get();
    assert.notEqual(row.password_hash, "fictional-review-password");
    assert.equal(row.password_hash.length, 128);
    assert.equal(
      store.db
        .prepare("SELECT token_hash FROM sessions")
        .get()
        .token_hash.includes(token),
      false,
    );
    await assert.rejects(auth.setup("second", "fictional-review-password"));
    auth.revoke(token);
    assert.equal(auth.user(token), null);
    const fresh = await auth.login(
      "REVIEW.OWNER",
      "fictional-review-password",
      "local",
    );
    assert.ok(auth.user(fresh));
    store.db.prepare("UPDATE sessions SET expires_at=0").run();
    assert.equal(auth.user(fresh), null);
  } finally {
    store.close();
  }
});

test("incorrect credentials are throttled and bearer matching requires a strong configured token", async () => {
  const store = new Store(":memory:");
  try {
    const auth = new Auth(store.db);
    await auth.setup("owner", "fictional-review-password");
    for (let i = 0; i < 5; i++)
      await assert.rejects(
        auth.login("owner", "incorrect", "attacker"),
        (error) => error.status === 401,
      );
    await assert.rejects(
      auth.login("owner", "fictional-review-password", "attacker"),
      (error) => error.status === 429,
    );
    assert.equal(bearerMatches("Bearer short", "short"), false);
    const token = "x".repeat(48);
    assert.equal(bearerMatches(`Bearer ${token}`, token), true);
    assert.equal(bearerMatches(`Bearer ${token}x`, token), false);
  } finally {
    store.close();
  }
});

test(
  "network: protected MCP, cookie lifecycle, origin guard, preferences and full handoff history",
  { skip: !process.env.RUN_NETWORK_TESTS },
  async () => {
    const store = new Store(":memory:");
    const { app } = createApp({ store, port: 0, authRequired: true });
    const listener = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => listener.once("listening", resolve));
    const origin = `http://127.0.0.1:${listener.address().port}`;
    const post = (path, body, headers = {}) =>
      fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...headers,
        },
        body: JSON.stringify(body),
      });
    let client;
    try {
      assert.equal((await post("/mcp", {})).status, 401);
      assert.equal(
        (await (await fetch(`${origin}/api/auth/status`)).json()).setupRequired,
        true,
      );
      assert.equal(
        (
          await post(
            "/api/auth/setup",
            { username: "owner", password: "fictional-review-password" },
            { Origin: "https://untrusted.example" },
          )
        ).status,
        403,
      );
      const setup = await post("/api/auth/setup", {
        username: "owner",
        password: "fictional-review-password",
      });
      assert.equal(setup.status, 200);
      const setCookie = setup.headers.get("set-cookie");
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Strict/);
      const cookie = setCookie.split(";")[0];
      assert.equal(
        (
          await fetch(`${origin}/mcp`, {
            method: "POST",
            headers: { Cookie: cookie, "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        403,
      );
      client = new Client({ name: "authenticated-test", version: "1" });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
          requestInit: { headers: { Cookie: cookie, Origin: origin } },
        }),
      );
      const call = (name, args = {}) =>
        client.callTool({ name, arguments: args });
      const created = await call("record_arrival", {
        eventKey: "protected",
        kind: "parcel",
        note: "Safe test record",
      });
      const id = created.structuredContent.handoff.id;
      const originalDeadline = created.structuredContent.handoff.deadline;
      assert.equal(
        (
          await call("household_preferences", {
            household: "Review home",
            resident: "Resident",
            instructions: "Leave on the bench.",
            acknowledgementSeconds: 30,
          })
        ).isError,
        undefined,
      );
      assert.equal(store.get(id).deadline, originalDeadline);
      const invalid = await call("household_preferences", {
        household: "",
        resident: "R",
        instructions: "Valid",
        acknowledgementSeconds: 1,
      });
      assert.equal(invalid.isError, true);
      await call("acknowledge_arrival", { handoffId: id });
      await call("complete_handoff", { handoffId: id });
      for (let i = 0; i < 51; i++)
        store.create({ eventKey: `history-${i}`, kind: "parcel" });
      assert.equal(store.snapshot().history.length, 50);
      const detail = await call("handoff_details", { handoffId: id });
      assert.equal(detail.structuredContent.history.length, 3);
      assert.equal(detail.structuredContent.handoff.status, "completed");
      assert.equal(
        (await post("/api/auth/logout", {}, { Cookie: cookie })).status,
        200,
      );
      assert.equal((await post("/mcp", {}, { Cookie: cookie })).status, 401);
      const login = await post("/api/auth/login", {
        username: "owner",
        password: "fictional-review-password",
      });
      assert.equal(login.status, 200);
      assert.notEqual(login.headers.get("set-cookie").split(";")[0], cookie);
    } finally {
      if (client) await client.close();
      await new Promise((resolve) => listener.close(resolve));
      store.close();
    }
  },
);
