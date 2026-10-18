# Discord Admin MCP v0.1

Remote, OAuth-protected MCP server for administering allowlisted Discord servers through a dedicated Discord bot.

## What it gives ChatGPT

### Read
- `discord_list_guilds`
- `discord_snapshot_server`
- `discord_read_messages`
- `discord_list_channels`
- `discord_list_roles`
- `discord_list_members`
- `discord_get_member`
- `discord_get_audit_log`

### Write
- `discord_send_message`
- `discord_edit_message`
- `discord_create_channel`
- `discord_update_channel`
- `discord_create_role`
- `discord_update_role`
- `discord_set_member_role`
- `discord_set_channel_permission`

### Destructive / approval-oriented
- `discord_delete_message`
- `discord_delete_channel`
- `discord_delete_role`
- `discord_delete_channel_permission`

The MCP never uses a Discord user token. It uses a normal bot token stored only on the server.

## 1. Create the Discord bot

In Discord Developer Portal:

1. Create a new application.
2. Open **Bot** and create the bot.
3. Enable **Server Members Intent** if member listing is needed.
4. Enable **Message Content Intent** if message text should be readable reliably.
5. Copy the bot token into Vercel environment variables later. Do not commit it or paste it into chats.
6. Create an OAuth2 bot invite and invite it to a test server.
7. For the initial test, `Administrator` is the simplest permission set. Reduce permissions later if desired.
8. Enable Discord Developer Mode and copy the server ID.

Discord role hierarchy still applies: the bot cannot manage roles above its highest role.

## 2. OAuth/Auth0

This project intentionally requires OAuth. An Administrator-capable Discord MCP should not be exposed publicly without authentication.

Use Auth0 as the authorization server:

- Issuer: your Auth0 tenant URL, e.g. `https://tenant.us.auth0.com/`
- Resource/API audience: your canonical MCP origin, e.g. `https://discord-mcp.example.com`
- Scope: `discord.mcp`
- Authorization code flow + PKCE S256
- Enable/configure Auth0's current MCP/CIMD support

The MCP publishes protected-resource metadata at:

```text
/.well-known/oauth-protected-resource
```

The resource server verifies access-token signature, issuer, audience, expiry, and scopes against Auth0 JWKS.

## 3. Environment variables

Copy `.env.example` to `.env.local` locally, or configure the same variables in Vercel:

```text
DISCORD_BOT_TOKEN=...
ALLOWED_GUILD_IDS=123456789012345678
AUTH0_ISSUER_BASE_URL=https://YOUR_TENANT.us.auth0.com/
AUTH0_AUDIENCE=https://YOUR-MCP-DOMAIN
AUTH0_REQUIRED_SCOPE=discord.mcp
MCP_PUBLIC_URL=https://YOUR-MCP-DOMAIN
```

`ALLOWED_GUILD_IDS` is a hard server-side allowlist. The MCP refuses to act on other servers even if the bot is present there.

## 4. Local run

```bash
npm install
npm run dev
```

Optional Discord credentials smoke test:

```bash
npm run smoke:discord
```

MCP endpoint:

```text
http://localhost:3000/mcp
```

Use MCP Inspector with Streamable HTTP for local protocol testing.

## 5. Deploy on Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add all environment variables.
4. Deploy.
5. Set `MCP_PUBLIC_URL` and Auth0 audience to the final production origin.
6. Redeploy if those values changed.

Production MCP URL:

```text
https://YOUR-DOMAIN/mcp
```

Vercel `mcp-handler` v2 supports the current stateless MCP protocol and older Streamable HTTP clients from the same endpoint.

## 6. Connect it to ChatGPT

In ChatGPT:

1. Open **Plugins**.
2. Select `+` → **Add custom MCP server**.
3. Enter `https://YOUR-DOMAIN/mcp`.
4. Choose **OAuth** authentication.
5. Complete the linking flow.
6. Create/install the personal plugin.
7. Open a new Work conversation and invoke the plugin.

Good first tests:

```text
List the Discord servers you can see.
Take a structural snapshot of my test server.
List its channels and roles.
Create a category named MCP TEST.
```

## Security properties

- No Discord self-bot/user token.
- Discord bot token never returned by a tool.
- OAuth required on the MCP endpoint.
- Guild allowlist enforced server-side.
- Mentions disabled by default when sending messages.
- Destructive tools are marked `destructiveHint: true`.
- Read-only tools are marked `readOnlyHint: true`.

## Next layer after v0.1 works

Recommended additions:

- forum/thread management;
- AutoMod management;
- emoji/sticker management;
- invite management;
- webhook management with secret redaction;
- timeout/kick/ban tools as separately approval-gated operations;
- richer Discord component/message creation;
- a two-phase `plan_changes` → `apply_changes` bulk server refactor workflow.
