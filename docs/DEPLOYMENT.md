# Deployment Guide

## Prerequisites

1. A configured `.env` file (see [SETUP.md](SETUP.md)).
2. A successful local test — run `pnpm dev` and verify the bot responds.

---

## Docker

### Build and Run

```bash
docker build -t starkfi-bot .
docker run -d --name starkfi-bot --env-file .env --restart unless-stopped starkfi-bot
```

### Docker Compose

```yaml
services:
    bot:
        build: .
        env_file: .env
        restart: unless-stopped
        volumes:
            - bot-data:/app/.data

volumes:
    bot-data:
```

```bash
docker compose up -d        # start
docker compose logs -f      # logs
docker compose down         # stop
```

The `bot-data` volume persists the SQLite database and user sessions across restarts.

---

## Railway (Cloud)

### Setup

1. Create a [Railway](https://railway.app) account and a new project.
2. Connect your GitHub repository (`starkfi-telegram-bot`) and select the `main` branch.
3. Railway auto-detects the `Dockerfile` and builds from it.

### Volume (Persistent Storage)

Add a volume to persist the SQLite database across deployments:

1. Click **+ Add** → **Volume**.
2. Set **Mount Path** to `/app/.data`.
3. Attach it to the `starkfi-telegram-bot` service.

### Environment Variables

Add these in the **Variables** tab:

| Variable                | Required | Description                        |
| ----------------------- | -------- | ---------------------------------- |
| `TELEGRAM_BOT_TOKEN`    | Yes      | Bot token from BotFather           |
| `BOT_ENCRYPTION_SECRET` | Yes      | 64-char hex string for AES-256-GCM |
| `STARKFI_SERVER_URL`    | Yes      | StarkFi authentication server URL  |
| `LOG_LEVEL`             | No       | `debug`, `info`, `warn`, or `error` (default: `info`) |

### How It Works

Railway deploys a single container instance. The bot uses long polling — no public URL or webhook needed. Auto-deploys on every push to `main`.

---

## Production Checklist

### Security

- [ ] `BOT_ENCRYPTION_SECRET` is a unique, random 64-char hex string
- [ ] `.env` is in `.gitignore`
- [ ] Firewall allows only outbound HTTPS (443) — no inbound ports needed

### Reliability

- [ ] Process auto-restarts on crash
- [ ] Logs are captured and rotated
- [ ] `.data/` is on persistent storage

### Performance

- [ ] `NODE_ENV=production` is set
- [ ] `LOG_LEVEL=warn` or `error` in production
- [ ] `MCP_IDLE_TIMEOUT_MS` tuned for expected activity

---

## Updating

```bash
git pull origin main
pnpm install
pnpm build

# Restart with your chosen method:
docker compose up -d --build   # Docker
# Railway: auto-deploys on push to main
```

---

## Troubleshooting

**Bot doesn't respond:**

- Verify `TELEGRAM_BOT_TOKEN` is correct.
- Ensure no other instance is running — Telegram allows one long-polling connection per token.

**"BOT_ENCRYPTION_SECRET must be a 64-character hex string":**

- Regenerate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

**MCP process fails to spawn:**

- Test manually: `npx -y starkfi@latest mcp-start`.
- Set `LOG_LEVEL=debug` for detailed error output.

**SQLite errors on restart:**

- Mount `.data/` as a persistent volume (`docker-compose.yml` example above).
- On Railway, ensure the volume is attached with mount path `/app/.data`.
