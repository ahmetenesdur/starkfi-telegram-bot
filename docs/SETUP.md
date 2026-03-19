# Setup Guide

## 1. Create a Telegram Bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the token — you'll need it for `TELEGRAM_BOT_TOKEN`.

## 2. Generate Encryption Secret

The bot encrypts user API keys with AES-256-GCM. Generate a 32-byte key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the 64-character hex output as `BOT_ENCRYPTION_SECRET`.

## 3. Environment Variables

```bash
cp .env.example .env
```

### Required

| Variable                | Description                        |
| ----------------------- | ---------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | Bot token from BotFather           |
| `BOT_ENCRYPTION_SECRET` | 64-char hex string for AES-256-GCM |
| `STARKFI_SERVER_URL`    | StarkFi authentication server URL  |

### Optional

| Variable                | Default                       | Description                          |
| ----------------------- | ----------------------------- | ------------------------------------ |
| `STARKFI_MCP_COMMAND`   | `npx`                         | Command to spawn StarkFi MCP server  |
| `STARKFI_MCP_ARGS`      | `-y,starkfi@latest,mcp-start` | Comma-separated args for MCP command |
| `LOG_LEVEL`             | `info`                        | `debug`, `info`, `warn`, or `error`  |
| `MAX_HISTORY`           | `20`                          | Max messages kept per user           |
| `RATE_LIMIT_PER_MINUTE` | `30`                          | Per-user rate limit                  |
| `MCP_IDLE_TIMEOUT_MS`   | `300000`                      | Idle MCP process timeout (ms)        |
| `PORT`                  | `8080`                        | Health check HTTP server port        |

### Webhook Mode (Optional)

By default, the bot uses **long polling** — no public URL needed. To use webhooks instead, set these variables:

| Variable               | Description                                  |
| ---------------------- | -------------------------------------------- |
| `WEBHOOK_DOMAIN`       | Public domain (e.g. `https://bot.example.com`) |
| `WEBHOOK_SECRET_PATH`  | Custom webhook path (default: `/webhook/<token>`) |

When `WEBHOOK_DOMAIN` is set, the bot starts in webhook mode and skips the separate health check server (the webhook HTTP server handles both).

## 4. Install and Run

```bash
pnpm install
pnpm dev
```

Development mode uses `tsx watch` for hot-reload. The bot connects via long polling by default.

## Scripts

| Script              | Purpose                     |
| ------------------- | --------------------------- |
| `pnpm dev`          | Development with hot-reload |
| `pnpm build`        | Production build (tsup)     |
| `pnpm start`        | Run production build        |
| `pnpm typecheck`    | Type check without emitting |
| `pnpm lint`         | ESLint                      |
| `pnpm lint:fix`     | ESLint auto-fix             |
| `pnpm format`       | Prettier format             |
| `pnpm format:check` | Prettier check              |
