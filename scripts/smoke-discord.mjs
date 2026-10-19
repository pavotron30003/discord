const token = process.env.DISCORD_BOT_TOKEN;
const allowed = (process.env.ALLOWED_GUILD_IDS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

if (!token) throw new Error("DISCORD_BOT_TOKEN is missing");
if (!allowed.length) throw new Error("ALLOWED_GUILD_IDS is missing");

const base = "https://discord.com/api/v10";
const headers = { Authorization: `Bot ${token}`, "User-Agent": "DiscordAdminMCP-smoke/0.1" };

const me = await fetch(`${base}/users/@me`, { headers });
if (!me.ok) throw new Error(`Bot auth failed: ${me.status} ${await me.text()}`);
const bot = await me.json();
console.log(`Authenticated as ${bot.username} (${bot.id})`);

for (const guildId of allowed) {
  const res = await fetch(`${base}/guilds/${guildId}`, { headers });
  if (!res.ok) {
    console.error(`Guild ${guildId}: ${res.status} ${await res.text()}`);
    continue;
  }
  const guild = await res.json();
  console.log(`Guild OK: ${guild.name} (${guild.id})`);
}
