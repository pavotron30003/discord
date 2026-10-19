import { getAllowedGuildIds, getDiscordToken } from "./env";

const API = "https://discord.com/api/v10";

export class DiscordApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

export function assertAllowedGuild(guildId: string) {
  if (!getAllowedGuildIds().has(guildId)) {
    throw new Error(`Guild ${guildId} is not in ALLOWED_GUILD_IDS`);
  }
}

export async function discordFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${getDiscordToken()}`,
      "Content-Type": "application/json",
      "User-Agent": "DiscordAdminMCP/0.1",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "message" in body
      ? String((body as any).message)
      : `Discord API error ${res.status}`;
    throw new DiscordApiError(res.status, msg, body);
  }
  return body as T;
}

export async function getChannelChecked(channelId: string) {
  const channel = await discordFetch<any>(`/channels/${channelId}`);
  if (!channel.guild_id) throw new Error("DM/group-DM channels are not supported");
  assertAllowedGuild(channel.guild_id);
  return channel;
}

export const compactChannel = (c: any) => ({
  id: c.id,
  guild_id: c.guild_id ?? null,
  parent_id: c.parent_id ?? null,
  name: c.name ?? null,
  type: c.type,
  position: c.position ?? null,
  topic: c.topic ?? null,
  nsfw: c.nsfw ?? false,
  rate_limit_per_user: c.rate_limit_per_user ?? 0,
  permission_overwrites: c.permission_overwrites ?? [],
});

export const compactRole = (r: any) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  position: r.position,
  permissions: r.permissions,
  hoist: r.hoist,
  mentionable: r.mentionable,
  managed: r.managed,
});

export const compactMember = (m: any) => ({
  user: m.user ? {
    id: m.user.id,
    username: m.user.username,
    global_name: m.user.global_name ?? null,
    bot: m.user.bot ?? false,
  } : null,
  nick: m.nick ?? null,
  roles: m.roles ?? [],
  joined_at: m.joined_at ?? null,
  pending: m.pending ?? false,
  communication_disabled_until: m.communication_disabled_until ?? null,
});

export const compactMessage = (m: any) => ({
  id: m.id,
  channel_id: m.channel_id,
  guild_id: m.guild_id ?? null,
  author: m.author ? {
    id: m.author.id,
    username: m.author.username,
    global_name: m.author.global_name ?? null,
    bot: m.author.bot ?? false,
  } : null,
  content: m.content ?? "",
  timestamp: m.timestamp,
  edited_timestamp: m.edited_timestamp ?? null,
  pinned: m.pinned ?? false,
  attachments: (m.attachments ?? []).map((a: any) => ({
    id: a.id,
    filename: a.filename,
    url: a.url,
    content_type: a.content_type ?? null,
    size: a.size,
  })),
});

export function toolResult(data: unknown, summary?: string) {
  return {
    content: [{ type: "text" as const, text: summary ? `${summary}\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2) }],
    structuredContent: { data },
  };
}

export function toolError(error: unknown) {
  if (error instanceof DiscordApiError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Discord API error ${error.status}: ${error.message}\n${JSON.stringify(error.body, null, 2)}` }],
    };
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
  };
}
