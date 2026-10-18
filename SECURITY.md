# Security

Never commit or paste into chats:

- `DISCORD_BOT_TOKEN`
- Auth0 client secrets
- OAuth access/refresh tokens
- webhook tokens

Store deployment secrets only in the hosting provider's encrypted environment variables.

This MCP must use a Discord bot account, never a Discord user token or self-bot.

If the bot token is exposed:

1. Reset the token in Discord Developer Portal.
2. Replace the Vercel environment variable.
3. Redeploy.
4. Review Discord audit logs.
