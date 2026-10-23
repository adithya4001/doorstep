import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Store } from "../lib/store.mjs";
import { createMcpServer } from "../lib/mcp.mjs";

test("HTTP Request/Response transport negotiates 2025-11-25 and validates complete workflow without a socket", async () => {
  const store = new Store(":memory:");
  const fetcher = async (url, init) => {
    const server = createMcpServer(store);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(new Request(url, init));
    const body = await response.arrayBuffer();
    await server.close();
    return new Response(response.status === 202 ? null : body, {
      status: response.status,
      headers: response.headers,
    });
  };
  const client = new Client({
    name: "doorstep-memory-http-test",
    version: "1",
  });
  try {
    const initialize = await fetcher("http://localhost/mcp", {
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
          clientInfo: { name: "test", version: "1" },
        },
      }),
    });
    assert.equal(
      (await initialize.json()).result.protocolVersion,
      "2025-11-25",
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost/mcp"), {
        fetch: fetcher,
      }),
    );
    assert.equal((await client.listTools()).tools.length, 6);
    const created = await client.callTool({
      name: "record_arrival",
      arguments: { eventKey: "same-event", kind: "parcel" },
    });
    const retry = await client.callTool({
      name: "record_arrival",
      arguments: { eventKey: "same-event", kind: "parcel" },
    });
    assert.equal(retry.structuredContent.duplicate, true);
    const id = created.structuredContent.handoff.id;
    assert.equal(
      (
        await client.callTool({
          name: "complete_handoff",
          arguments: { handoffId: id },
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await client.callTool({
          name: "record_arrival",
          arguments: { eventKey: "bad", kind: "unlock" },
        })
      ).isError,
      true,
    );
    await client.callTool({
      name: "acknowledge_arrival",
      arguments: { handoffId: id },
    });
    await client.callTool({
      name: "set_quiet_mode",
      arguments: { enabled: false },
    });
    await client.callTool({
      name: "complete_handoff",
      arguments: { handoffId: id },
    });
    const final = (
      await client.callTool({ name: "home_status", arguments: {} })
    ).structuredContent;
    assert.equal(final.handoffs.length, 1);
    assert.equal(final.handoffs[0].status, "completed");
    assert.equal(final.preferences.quietMode, false);
    assert.equal(final.history.length, 3);
  } finally {
    await client.close();
    store.close();
  }
});
