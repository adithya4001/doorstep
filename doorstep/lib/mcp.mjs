import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMcpServer(store) {
  const server = new McpServer({ name: "doorstep", version: "0.2.0" });
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
    "household_preferences",
    "Update resident name, household label, handoff instructions and acknowledgement window after an explicit owner request. Existing arrival deadlines are unchanged.",
    {
      resident: z.string().trim().min(1).max(40),
      household: z.string().trim().min(1).max(60),
      instructions: z.string().trim().min(1).max(400),
      acknowledgementSeconds: z.number().int().min(30).max(1800),
    },
    (args) => ({ preferences: store.setPreferences(args) }),
  );
  register(
    "handoff_details",
    "Read one handoff and its complete saved transition history.",
    { handoffId: z.string().uuid() },
    ({ handoffId }) => ({
      handoff: store.get(handoffId),
      history: store.db
        .prepare("SELECT * FROM history WHERE handoff_id=? ORDER BY sequence")
        .all(handoffId),
    }),
    true,
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
