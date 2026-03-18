// mcp/src/index.ts — Design Intel MCP Server entry point

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express, { Request, Response } from "express";

import { registerFigmaTools } from "./tools/figma-tools.js";
import { registerAsanaTools } from "./tools/asana-tools.js";
import { registerIntelTools } from "./tools/intel-tools.js";

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "design-intel-mcp-server",
  version: "1.0.0",
});

registerFigmaTools(server);
registerAsanaTools(server);
registerIntelTools(server);

// ── Transport: HTTP (deployed) or stdio (local/Claude Code) ──────────────────

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", server: "design-intel-mcp-server", version: "1.0.0" });
  });

  // MCP endpoint — stateless, new transport per request
  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3001");
  app.listen(port, () => {
    console.error(`[design-intel-mcp] HTTP server running on port ${port}`);
    console.error(`[design-intel-mcp] MCP endpoint: http://localhost:${port}/mcp`);
  });
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[design-intel-mcp] Running via stdio");
}

// Choose transport based on env
const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((err: unknown) => {
    console.error("[design-intel-mcp] Fatal error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    console.error("[design-intel-mcp] Fatal error:", err);
    process.exit(1);
  });
}
