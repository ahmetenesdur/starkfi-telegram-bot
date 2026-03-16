# Setup Guide

## 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to name your bot.
3. Copy the bot token — you'll need it for `TELEGRAM_BOT_TOKEN`.

## 2. Generate Encryption Secret

The bot encrypts user API keys at rest with AES-256-GCM. Generate a 32-byte hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This outputs a 64-character hex string. Use it for `BOT_ENCRYPTION_SECRET`.

## 3. Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

### Required

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `BOT_ENCRYPTION_SECRET` | 64-char hex string for AES-256-GCM encryption |
| `STARKFI_SERVER_URL` | StarkFi authentication server endpoint |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `STARKFI_MCP_COMMAND` | `npx` | Command to spawn StarkFi MCP server |
| `STARKFI_MCP_ARGS` | `-y,starkfi@latest,mcp-start` | Comma-separated args for the MCP command |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `MAX_HISTORY` | `20` | Max conversation messages kept per user |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per-user message rate limit |
| `MCP_IDLE_TIMEOUT_MS` | `300000` | Kill idle MCP processes after this (ms) |

## 4. Install Dependencies

```bash
pnpm install
```

## 5. Run in Development

```bash
pnpm dev
```

This uses `tsx watch` for hot-reload. The bot connects to Telegram via long polling.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Development mode with hot-reload (tsx watch) |
| `pnpm build` | Production build via tsup |
| `pnpm start` | Run production build (`dist/index.js`) |
| `pnpm typecheck` | TypeScript type check without emitting |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier format |
| `pnpm format:check` | Prettier check |
