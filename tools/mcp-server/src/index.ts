#!/usr/bin/env node
// Kojima Solutions MCP server.
// Exposes objectives, subtasks and focus sessions as MCP tools so that
// Claude Code (or any MCP-aware client) can read and modify the workspace
// using the user's existing Claude subscription instead of paid API tokens.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, dispatch } from "./tools.js";

const server = new Server(
  { name: "kojima-solutions", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  try {
    const result = await dispatch(name, args as Record<string, any>);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (e: any) {
    return {
      content: [
        { type: "text", text: `Error: ${e?.message ?? String(e)}` },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// MCP servers run silently on stdio; log to stderr only.
console.error("[kojima-mcp] ready");
