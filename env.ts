function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getDiscordToken(): string {
  return required("DISCORD_BOT_TOKEN");
}

export function getAllowedGuildIds(): Set<string> {
  const ids = required("ALLOWED_GUILD_IDS")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!ids.length) throw new Error("ALLOWED_GUILD_IDS must not be empty");
  return new Set(ids);
}

export function getAuthConfig() {
  const issuer = required("AUTH0_ISSUER_BASE_URL").replace(/\/+$/, "");
  const audience = required("AUTH0_AUDIENCE");
  const requiredScope = process.env.AUTH0_REQUIRED_SCOPE?.trim() || "discord.mcp";
  return { issuer, audience, requiredScope };
}

export function getMcpPublicUrl() {
  return required("MCP_PUBLIC_URL").replace(/\/+$/, "");
}
