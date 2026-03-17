# Deployment Guide

## Prerequisites

1. A configured `.env` file (see [SETUP.md](SETUP.md)).
2. A successful local test — run `pnpm dev` and verify the bot responds.
3. Node.js 18+ on your server (unless using Docker).

---

## Option 1: Docker (Recommended)

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

## Option 2: AWS App Runner

### Source-Based Deployment

1. Create a new App Runner service → **Source code repository**.
2. Connect your GitHub repository and select the `main` branch.
3. Configure build settings:

| Setting | Value |
| --------------- | ---------------------------------------------------- |
| Runtime         | Node.js 20                                           |
| Build command   | `npm install -g pnpm && pnpm install && pnpm build`  |
| Start command   | `node dist/index.js`                                 |
| Port            | `8080`                                               |

4. Add environment variables in the **Configuration** tab:
   - `TELEGRAM_BOT_TOKEN`
   - `BOT_ENCRYPTION_SECRET`
   - `STARKFI_SERVER_URL`

5. Set **Auto scaling** → min: `1`, max: `1`.

> **Important:** Telegram allows only one long-polling connection per bot token. Running multiple instances will cause message conflicts. Always keep App Runner pinned to a single instance.

### Health Check

The bot starts an HTTP server on port 8080 that responds `200 OK`. App Runner uses this for health checks automatically — no extra configuration needed.

---

## Option 3: PM2

### Setup

```bash
npm install -g pm2
pnpm build
pm2 start dist/index.js --name starkfi-bot
```

### Commands

```bash
pm2 status              # process status
pm2 logs starkfi-bot    # tail logs
pm2 restart starkfi-bot # restart
pm2 stop starkfi-bot    # stop
```

### Auto-start on Boot

```bash
pm2 startup   # generates a platform-specific command — run what it outputs
pm2 save
```

### Ecosystem File (Optional)

```js
// ecosystem.config.cjs
module.exports = {
	apps: [
		{
			name: "starkfi-bot",
			script: "dist/index.js",
			env: { NODE_ENV: "production" },
			max_memory_restart: "256M",
		},
	],
};
```

```bash
pm2 start ecosystem.config.cjs
```

---

## Option 4: systemd

### Setup

```bash
pnpm build
sudo nano /etc/systemd/system/starkfi-bot.service
```

```ini
[Unit]
Description=StarkFi Telegram Bot
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/starkfi-telegram-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=/home/deploy/starkfi-telegram-bot/.env

[Install]
WantedBy=multi-user.target
```

> Adjust `User`, `WorkingDirectory`, and `EnvironmentFile` to match your setup.

### Commands

```bash
sudo systemctl daemon-reload
sudo systemctl enable starkfi-bot
sudo systemctl start starkfi-bot

sudo systemctl status starkfi-bot    # status
sudo journalctl -u starkfi-bot -f    # logs
sudo systemctl restart starkfi-bot   # restart
```

---

## Production Checklist

### Security

- [ ] `BOT_ENCRYPTION_SECRET` is a unique, random 64-char hex string
- [ ] `.env` is in `.gitignore`
- [ ] Bot runs as a non-root user
- [ ] Firewall allows only outbound HTTPS (443) — no inbound ports needed

### Reliability

- [ ] Process auto-restarts on crash
- [ ] Service starts on boot
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
docker compose up -d --build        # Docker
pm2 restart starkfi-bot             # PM2
sudo systemctl restart starkfi-bot  # systemd
# App Runner: auto-deploys on push if connected to GitHub
```

---

## Troubleshooting

**Bot doesn't respond:**

- Verify `TELEGRAM_BOT_TOKEN` is correct.
- Ensure no other instance is running — Telegram allows one long-polling connection per token.
- If using App Runner, verify scaling is set to min=1, max=1.

**"BOT_ENCRYPTION_SECRET must be a 64-character hex string":**

- Regenerate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

**MCP process fails to spawn:**

- Test manually: `npx -y starkfi@latest mcp-start`.
- Set `LOG_LEVEL=debug` for detailed error output.

**SQLite errors on restart:**

- Mount `.data/` as a persistent volume (`docker-compose.yml` example above).
