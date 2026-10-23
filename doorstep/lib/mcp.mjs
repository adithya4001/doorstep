import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMcpServer(store) {
  const server = new McpServer({ name: "doorstep", version: "0.1.0" });
  const register = (
    name,
    description,
    inputSchema,
    handler,
    readOnlyHint = false,
  ) =>
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint,
          destructiveHint: false,
          idempotentHint: readOnlyHint || name === "record_arrival",
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          const result = handler(args);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text", text: error.message }],
          };
        }
      },
    );
  register(
    "home_status",
    "Read persistent arrival status, resident preferences and an audit trail. Events in this demo are manually entered, not sourced from Ring.",
    {},
    () => store.snapshot(),
    true,
  );
  register(
    "record_arrival",
    "Record a manually observed parcel or visitor arrival. Requires the resident to explicitly request it. Reuse eventKey when retrying the same arrival.",
    {
      eventKey: z.string().min(1).max(100),
      kind: z.enum(["parcel", "visitor"]),
      note: z.string().max(240).optional(),
    },
    (args) => store.create(args),
  );
  register(
    "acknowledge_arrival",
    "The resident confirms that they saw an arrival. Ask the resident before calling. This never unlocks a door or contacts a visitor.",
    {
      handoffId: z.string().uuid(),
    },
    ({ handoffId }) => ({
      handoff: store.move(handoffId, "acknowledged"),
      instructions: store.preferences().instructions,
    }),
  );
  register(
    "complete_handoff",
    "Mark a handoff complete only after the resident explicitly confirms it was received. Acknowledgement must happen first.",
    {
      handoffId: z.string().uuid(),
    },
    ({ handoffId }) => ({ handoff: store.move(handoffId, "completed") }),
  );
  register(
    "cancel_handoff",
    "Cancel an active arrival after resident confirmation.",
    {
      handoffId: z.string().uuid(),
    },
    ({ handoffId }) => ({ handoff: store.move(handoffId, "cancelled") }),
  );
  register(
    "set_quiet_mode",
    "Enable or disable quiet mode after an explicit resident request. Quiet mode changes this app only; it does not control a physical doorbell.",
    {
      enabled: z.boolean(),
    },
    ({ enabled }) => ({
      preferences: store.setPreferences({ quietMode: enabled }),
    }),
  );
  return server;
}
