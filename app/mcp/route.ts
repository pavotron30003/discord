import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  assertAllowedGuild,
  compactChannel,
  compactMember,
  compactMessage,
  compactRole,
  discordFetch,
  getChannelChecked,
  toolError,
  toolResult,
} from "../../lib/discord";
import { getAllowedGuildIds, getAuthConfig } from "../../lib/env";
import { verifyOAuthToken } from "../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const { requiredScope } = getAuthConfig();
const oauthScheme = [{ type: "oauth2", scopes: [requiredScope] }];

function descriptor<TInput extends z.ZodType>(config: {
  title: string;
  description: string;
  inputSchema: TInput;
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
}) {
  return {
    title: config.title,
    description: config.description,
    inputSchema: config.inputSchema,
    securitySchemes: oauthScheme,
    _meta: { securitySchemes: oauthScheme },
    annotations: {
      readOnlyHint: !!config.readOnly,
      destructiveHint: !!config.destructive,
      idempotentHint: !!config.idempotent,
      openWorldHint: false,
    },
  };
}

function auditHeaders(reason?: string): Record<string, string> {
  return reason ? { "X-Audit-Log-Reason": encodeURIComponent(reason) } : {};
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "discord_list_guilds",
      descriptor({
        title: "List Discord servers",
        description: "List allowlisted Discord servers visible to the bot.",
        inputSchema: z.object({}),
        readOnly: true,
      }),
      async () => {
        try {
          const guilds = await discordFetch<any[]>("/users/@me/guilds");
          const allowed = getAllowedGuildIds();
          return toolResult(
            guilds
              .filter((g) => allowed.has(g.id))
              .map((g) => ({ id: g.id, name: g.name, icon: g.icon ?? null })),
          );
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_snapshot_server",
      descriptor({
        title: "Snapshot Discord server",
        description: "Read server metadata, channels, and roles before planning structural changes.",
        inputSchema: z.object({ guild_id: z.string().min(1) }),
        readOnly: true,
      }),
      async ({ guild_id }) => {
        try {
          assertAllowedGuild(guild_id);
          const [guild, channels, roles] = await Promise.all([
            discordFetch<any>(`/guilds/${guild_id}?with_counts=true`),
            discordFetch<any[]>(`/guilds/${guild_id}/channels`),
            discordFetch<any[]>(`/guilds/${guild_id}/roles`),
          ]);
          return toolResult({
            guild: {
              id: guild.id,
              name: guild.name,
              description: guild.description ?? null,
              owner_id: guild.owner_id,
              member_count: guild.approximate_member_count ?? guild.member_count ?? null,
              features: guild.features ?? [],
            },
            channels: channels.map(compactChannel),
            roles: roles.map(compactRole),
          });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_read_messages",
      descriptor({
        title: "Read Discord messages",
        description: "Read recent messages from a channel in an allowlisted server.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          limit: z.number().int().min(1).max(100).default(50),
          before: z.string().optional(),
          after: z.string().optional(),
        }),
        readOnly: true,
      }),
      async ({ channel_id, limit, before, after }) => {
        try {
          await getChannelChecked(channel_id);
          const qs = new URLSearchParams({ limit: String(limit) });
          if (before) qs.set("before", before);
          if (after) qs.set("after", after);
          const messages = await discordFetch<any[]>(`/channels/${channel_id}/messages?${qs}`);
          return toolResult(messages.map(compactMessage));
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_send_message",
      descriptor({
        title: "Send Discord message",
        description: "Send a bot-authored text message. Mentions are disabled unless explicitly enabled.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          content: z.string().min(1).max(2000),
          allow_mentions: z.boolean().default(false),
        }),
      }),
      async ({ channel_id, content, allow_mentions }) => {
        try {
          await getChannelChecked(channel_id);
          const msg = await discordFetch<any>(`/channels/${channel_id}/messages`, {
            method: "POST",
            body: JSON.stringify({
              content,
              allowed_mentions: allow_mentions ? { parse: ["users", "roles"] } : { parse: [] },
            }),
          });
          return toolResult(compactMessage(msg), "Message sent.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_edit_message",
      descriptor({
        title: "Edit Discord message",
        description: "Edit a bot-authored message in an allowlisted server.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          message_id: z.string().min(1),
          content: z.string().min(1).max(2000),
        }),
        idempotent: true,
      }),
      async ({ channel_id, message_id, content }) => {
        try {
          await getChannelChecked(channel_id);
          const msg = await discordFetch<any>(`/channels/${channel_id}/messages/${message_id}`, {
            method: "PATCH",
            body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
          });
          return toolResult(compactMessage(msg), "Message updated.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_delete_message",
      descriptor({
        title: "Delete Discord message",
        description: "Delete one Discord message. This is destructive.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          message_id: z.string().min(1),
          reason: z.string().max(512).optional(),
        }),
        destructive: true,
        idempotent: true,
      }),
      async ({ channel_id, message_id, reason }) => {
        try {
          await getChannelChecked(channel_id);
          await discordFetch(`/channels/${channel_id}/messages/${message_id}`, {
            method: "DELETE",
            headers: auditHeaders(reason),
          });
          return toolResult({ deleted: true, channel_id, message_id });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_list_channels",
      descriptor({
        title: "List Discord channels",
        description: "List channels, categories, positions, and permission overwrites in an allowlisted server.",
        inputSchema: z.object({ guild_id: z.string().min(1) }),
        readOnly: true,
      }),
      async ({ guild_id }) => {
        try {
          assertAllowedGuild(guild_id);
          const channels = await discordFetch<any[]>(`/guilds/${guild_id}/channels`);
          return toolResult(channels.map(compactChannel));
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_create_channel",
      descriptor({
        title: "Create Discord channel",
        description: "Create a Discord channel or category in an allowlisted server.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          name: z.string().min(1).max(100),
          type: z.number().int().min(0).max(16).default(0),
          parent_id: z.string().nullable().optional(),
          topic: z.string().max(1024).nullable().optional(),
          nsfw: z.boolean().optional(),
          rate_limit_per_user: z.number().int().min(0).max(21600).optional(),
          reason: z.string().max(512).optional(),
        }),
      }),
      async ({ guild_id, reason, ...payload }) => {
        try {
          assertAllowedGuild(guild_id);
          const channel = await discordFetch<any>(`/guilds/${guild_id}/channels`, {
            method: "POST",
            headers: auditHeaders(reason),
            body: JSON.stringify(payload),
          });
          return toolResult(compactChannel(channel), "Channel created.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_update_channel",
      descriptor({
        title: "Update Discord channel",
        description: "Update selected fields on a Discord channel in an allowlisted server.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          name: z.string().min(1).max(100).optional(),
          topic: z.string().max(1024).nullable().optional(),
          parent_id: z.string().nullable().optional(),
          position: z.number().int().optional(),
          nsfw: z.boolean().optional(),
          rate_limit_per_user: z.number().int().min(0).max(21600).optional(),
          reason: z.string().max(512).optional(),
        }),
        idempotent: true,
      }),
      async ({ channel_id, reason, ...changes }) => {
        try {
          await getChannelChecked(channel_id);
          const channel = await discordFetch<any>(`/channels/${channel_id}`, {
            method: "PATCH",
            headers: auditHeaders(reason),
            body: JSON.stringify(changes),
          });
          return toolResult(compactChannel(channel), "Channel updated.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_delete_channel",
      descriptor({
        title: "Delete Discord channel",
        description: "Delete a Discord channel or category. This is destructive.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          reason: z.string().max(512).optional(),
        }),
        destructive: true,
        idempotent: true,
      }),
      async ({ channel_id, reason }) => {
        try {
          await getChannelChecked(channel_id);
          const channel = await discordFetch<any>(`/channels/${channel_id}`, {
            method: "DELETE",
            headers: auditHeaders(reason),
          });
          return toolResult(compactChannel(channel), "Channel deleted.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_list_roles",
      descriptor({
        title: "List Discord roles",
        description: "List roles, positions, and raw permission bitfields in an allowlisted server.",
        inputSchema: z.object({ guild_id: z.string().min(1) }),
        readOnly: true,
      }),
      async ({ guild_id }) => {
        try {
          assertAllowedGuild(guild_id);
          const roles = await discordFetch<any[]>(`/guilds/${guild_id}/roles`);
          return toolResult(roles.map(compactRole));
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_create_role",
      descriptor({
        title: "Create Discord role",
        description: "Create a Discord role. permissions is Discord's decimal permission bitfield string.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          name: z.string().min(1).max(100),
          color: z.number().int().min(0).max(0xffffff).default(0),
          permissions: z.string().regex(/^\d+$/).default("0"),
          hoist: z.boolean().default(false),
          mentionable: z.boolean().default(false),
          reason: z.string().max(512).optional(),
        }),
      }),
      async ({ guild_id, reason, ...payload }) => {
        try {
          assertAllowedGuild(guild_id);
          const role = await discordFetch<any>(`/guilds/${guild_id}/roles`, {
            method: "POST",
            headers: auditHeaders(reason),
            body: JSON.stringify(payload),
          });
          return toolResult(compactRole(role), "Role created.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_update_role",
      descriptor({
        title: "Update Discord role",
        description: "Update selected fields on a Discord role. Discord role hierarchy still applies.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          role_id: z.string().min(1),
          name: z.string().min(1).max(100).optional(),
          color: z.number().int().min(0).max(0xffffff).optional(),
          permissions: z.string().regex(/^\d+$/).optional(),
          hoist: z.boolean().optional(),
          mentionable: z.boolean().optional(),
          reason: z.string().max(512).optional(),
        }),
        idempotent: true,
      }),
      async ({ guild_id, role_id, reason, ...changes }) => {
        try {
          assertAllowedGuild(guild_id);
          const role = await discordFetch<any>(`/guilds/${guild_id}/roles/${role_id}`, {
            method: "PATCH",
            headers: auditHeaders(reason),
            body: JSON.stringify(changes),
          });
          return toolResult(compactRole(role), "Role updated.");
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_delete_role",
      descriptor({
        title: "Delete Discord role",
        description: "Delete one Discord role. This is destructive and can immediately change access.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          role_id: z.string().min(1),
          reason: z.string().max(512).optional(),
        }),
        destructive: true,
        idempotent: true,
      }),
      async ({ guild_id, role_id, reason }) => {
        try {
          assertAllowedGuild(guild_id);
          await discordFetch(`/guilds/${guild_id}/roles/${role_id}`, {
            method: "DELETE",
            headers: auditHeaders(reason),
          });
          return toolResult({ deleted: true, guild_id, role_id });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_list_members",
      descriptor({
        title: "List Discord members",
        description: "List members in an allowlisted server. Server Members Intent may be required.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          limit: z.number().int().min(1).max(1000).default(100),
          after: z.string().optional(),
        }),
        readOnly: true,
      }),
      async ({ guild_id, limit, after }) => {
        try {
          assertAllowedGuild(guild_id);
          const qs = new URLSearchParams({ limit: String(limit) });
          if (after) qs.set("after", after);
          const members = await discordFetch<any[]>(`/guilds/${guild_id}/members?${qs}`);
          return toolResult(members.map(compactMember));
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_get_member",
      descriptor({
        title: "Get Discord member",
        description: "Read one member, their role IDs, join time, nickname, and timeout state.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          user_id: z.string().min(1),
        }),
        readOnly: true,
      }),
      async ({ guild_id, user_id }) => {
        try {
          assertAllowedGuild(guild_id);
          const member = await discordFetch<any>(`/guilds/${guild_id}/members/${user_id}`);
          return toolResult(compactMember(member));
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_set_member_role",
      descriptor({
        title: "Add or remove member role",
        description: "Add or remove one role for one member in an allowlisted server.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          user_id: z.string().min(1),
          role_id: z.string().min(1),
          action: z.enum(["add", "remove"]),
          reason: z.string().max(512).optional(),
        }),
        idempotent: true,
      }),
      async ({ guild_id, user_id, role_id, action, reason }) => {
        try {
          assertAllowedGuild(guild_id);
          await discordFetch(`/guilds/${guild_id}/members/${user_id}/roles/${role_id}`, {
            method: action === "add" ? "PUT" : "DELETE",
            headers: auditHeaders(reason),
          });
          return toolResult({ ok: true, guild_id, user_id, role_id, action });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_set_channel_permission",
      descriptor({
        title: "Set channel permission overwrite",
        description: "Create or replace a role/member permission overwrite on a channel. allow/deny are Discord decimal permission bitfields.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          target_id: z.string().min(1),
          target_type: z.enum(["role", "member"]),
          allow: z.string().regex(/^\d+$/).default("0"),
          deny: z.string().regex(/^\d+$/).default("0"),
          reason: z.string().max(512).optional(),
        }),
        idempotent: true,
      }),
      async ({ channel_id, target_id, target_type, allow, deny, reason }) => {
        try {
          await getChannelChecked(channel_id);
          await discordFetch(`/channels/${channel_id}/permissions/${target_id}`, {
            method: "PUT",
            headers: auditHeaders(reason),
            body: JSON.stringify({ type: target_type === "role" ? 0 : 1, allow, deny }),
          });
          return toolResult({ ok: true, channel_id, target_id, target_type, allow, deny });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_delete_channel_permission",
      descriptor({
        title: "Delete channel permission overwrite",
        description: "Delete a role/member permission overwrite so the target inherits permissions again.",
        inputSchema: z.object({
          channel_id: z.string().min(1),
          target_id: z.string().min(1),
          reason: z.string().max(512).optional(),
        }),
        destructive: true,
        idempotent: true,
      }),
      async ({ channel_id, target_id, reason }) => {
        try {
          await getChannelChecked(channel_id);
          await discordFetch(`/channels/${channel_id}/permissions/${target_id}`, {
            method: "DELETE",
            headers: auditHeaders(reason),
          });
          return toolResult({ deleted: true, channel_id, target_id });
        } catch (e) { return toolError(e); }
      },
    );

    server.registerTool(
      "discord_get_audit_log",
      descriptor({
        title: "Read Discord audit log",
        description: "Read recent audit log entries from an allowlisted server.",
        inputSchema: z.object({
          guild_id: z.string().min(1),
          limit: z.number().int().min(1).max(100).default(50),
          user_id: z.string().optional(),
          action_type: z.number().int().optional(),
          before: z.string().optional(),
          after: z.string().optional(),
        }),
        readOnly: true,
      }),
      async ({ guild_id, limit, user_id, action_type, before, after }) => {
        try {
          assertAllowedGuild(guild_id);
          const qs = new URLSearchParams({ limit: String(limit) });
          if (user_id) qs.set("user_id", user_id);
          if (action_type !== undefined) qs.set("action_type", String(action_type));
          if (before) qs.set("before", before);
          if (after) qs.set("after", after);
          const log = await discordFetch<any>(`/guilds/${guild_id}/audit-logs?${qs}`);
          return toolResult(log);
        } catch (e) { return toolError(e); }
      },
    );
  },
  {
    serverInfo: { name: "discord-admin-mcp", version: "0.1.0" },
    instructions:
      "Private Discord administration MCP. Read state before structural changes. Prefer narrow edits. Destructive tools should be used only when explicitly requested.",
  },
);

const authHandler = withMcpAuth(handler, verifyOAuthToken, {
  required: true,
  requiredScopes: [requiredScope],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
