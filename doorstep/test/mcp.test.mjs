import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../server.mjs";
import { Store } from "../lib/store.mjs";

test(
  "network: official MCP client negotiates and completes a persisted multi-tool workflow",
  { skip: !process.env.RUN_NETWORK_TESTS },
  async () => {
    const store = new Store(":memory:");
    const { app } = createApp({ store, port: 0 });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const client = new Client({ name: "doorstep-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`));
    try {
      await client.connect(transport);
      assert.equal((await client.listTools()).tools.length, 6);
      const created = await client.callTool({
        name: "record_arrival",
        arguments: { eventKey: "integration", kind: "parcel" },
      });
      const id = created.structuredContent.handoff.id;
      const invalid = await client.callTool({
        name: "complete_handoff",
        arguments: { handoffId: id },
      });
      assert.equal(invalid.isError, true);
      const badInput = await client.callTool({
        name: "record_arrival",
        arguments: { eventKey: "bad", kind: "unlock" },
      });
      assert.equal(badInput.isError, true);
      await client.callTool({
        name: "acknowledge_arrival",
        arguments: { handoffId: id },
      });
      const completed = await client.callTool({
        name: "complete_handoff",
        arguments: { handoffId: id },
      });
      assert.equal(completed.structuredContent.handoff.status, "completed");
      await client.callTool({
        name: "set_quiet_mode",
        arguments: { enabled: false },
      });
      const status = await client.callTool({
        name: "home_status",
        arguments: {},
      });
      assert.equal(status.structuredContent.preferences.quietMode, false);
      const init = await fetch(`${url}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "probe", version: "1" },
          },
        }),
      });
      assert.equal((await init.json()).result.protocolVersion, "2025-11-25");
      const forbidden = await fetch(`${url}/mcp`, {
        method: "POST",
        headers: {
          Origin: "https://untrusted.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      assert.equal(forbidden.status, 403);
      assert.equal((await fetch(`${url}/mcp`)).status, 405);
      const summary = await fetch(`${url}/api/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!process.env.BEDROCK_MODEL_ID) assert.equal(summary.status, 503);
    } finally {
      await client.close();
      await new Promise((resolve) => server.close(resolve));
      store.close();
    }
  },
);
