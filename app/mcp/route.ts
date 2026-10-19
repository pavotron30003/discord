import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { getAuthConfig } from "../../lib/env";
import { verifyOAuthToken } from "../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { requiredScope } = getAuthConfig();

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "discord_mcp_ping",
      {
        title: "Discord MCP ping",
        description: "Checks that the private Discord MCP server can expose a tool.",
        inputSchema: z.object({}),
      },
      async () => ({
        content: [{ type: "text", text: "Discord MCP is online." }],
      }),
    );
  },
  {
    serverInfo: { name: "discord-admin-mcp", version: "0.1.1" },
    instructions: "Private Discord MCP discovery diagnostic.",
  },
);

const authHandler = withMcpAuth(handler, verifyOAuthToken, {
  required: true,
  requiredScopes: [requiredScope],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
