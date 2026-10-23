import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Store } from "./lib/store.mjs";
import { createMcpServer } from "./lib/mcp.mjs";
import { summarize } from "./lib/bedrock.mjs";
import { Auth, sessionToken, bearerMatches } from "./lib/auth.mjs";

export function createApp({
  store = new Store(process.env.DATA_PATH),
  port = 4317,
  authRequired = process.env.DOORSTEP_AUTH !== "off",
} = {}) {
  const app = express();
  const auth = new Auth(store.db);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const currentPort = req.get("host")?.split(":").pop();
    const allowed = [
      `http://127.0.0.1:${currentPort}`,
      `http://localhost:${currentPort}`,
    ];
    if (req.headers.origin && !allowed.includes(req.headers.origin))
      return res.status(403).json({ error: "Origin is not allowed." });
    if (!["127.0.0.1", "localhost"].includes(req.hostname))
      return res.status(403).json({ error: "Host is not allowed." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    );
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/mcp")
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  const cookie = (req, token) =>
    `doorstep_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 43200 : 0}${req.secure ? "; Secure" : ""}`;
  app.get("/api/auth/status", (req, res) =>
    res.json({
      required: authRequired,
      setupRequired: authRequired && !auth.hasOwner(),
      user: auth.user(sessionToken(req)),
      authenticated: !authRequired || Boolean(auth.user(sessionToken(req))),
    }),
  );
  app.post("/api/auth/:action", async (req, res) => {
    if (!req.headers.origin)
      return res
        .status(403)
        .json({ error: "An origin is required for account actions." });
    try {
      if (req.params.action === "logout") {
        auth.revoke(sessionToken(req));
        res.setHeader("Set-Cookie", cookie(req, ""));
        return res.json({ ok: true });
      }
      const { username, password } = req.body || {};
      const token =
        req.params.action === "setup"
          ? await auth.setup(username, password)
          : req.params.action === "login"
            ? await auth.login(username, password, req.ip)
            : null;
      if (!token)
        return res.status(404).json({ error: "Unknown account action." });
      res.setHeader("Set-Cookie", cookie(req, token));
      res.json({ user: auth.user(token) });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });
  app.use((req, res, next) => {
    if (!(req.path === "/mcp" || req.path.startsWith("/api/"))) return next();
    const bearer = bearerMatches(
      req.headers.authorization,
      process.env.DOORSTEP_MCP_TOKEN,
    );
    if (authRequired && !auth.user(sessionToken(req)) && !bearer)
      return res
        .status(401)
        .json({ error: "Sign in to your household to continue." });
    if (authRequired && !bearer && req.method !== "GET" && !req.headers.origin)
      return res
        .status(403)
        .json({ error: "An origin is required for session actions." });
    next();
  });
  app.get("/health", (_, res) =>
    res.json({
      status: "ok",
      protocol: "2025-11-25",
      mode: "local-demo",
      bedrockConfigured: Boolean(process.env.BEDROCK_MODEL_ID),
    }),
  );
  app.post("/mcp", async (req, res) => {
    const server = createMcpServer(store);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent)
        res
          .status(500)
          .json({ error: "The MCP request could not be handled." });
    }
  });
  app.all("/mcp", (_, res) =>
    res
      .status(405)
      .set("Allow", "POST")
      .json({ error: "This stateless server accepts POST only." }),
  );
  app.post("/api/summary", async (_, res) => {
    try {
      res.json(await summarize(store.snapshot()));
    } catch (error) {
      res.status(process.env.BEDROCK_MODEL_ID ? 502 : 503).json({
        error: process.env.BEDROCK_MODEL_ID
          ? "Bedrock could not be reached. Check your AWS credentials, region and model access."
          : error.message,
      });
    }
  });
  app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
  app.use((error, req, res, next) => {
    if (!res.headersSent)
      res
        .status(error.status || 500)
        .json({ error: "The request could not be processed." });
  });
  return { app, store };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 4317);
  const { app, store } = createApp({ port });
  const listener = app.listen(port, "127.0.0.1", () =>
    console.log(`Doorstep is ready at http://127.0.0.1:${port}`),
  );
  const timer = setInterval(() => store.sweep(), 1000);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
    listener.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
