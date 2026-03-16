# Deployment Guide

This guide covers getting the bot running in production. Choose the method that fits your infrastructure.

---

## Prerequisites

Before deploying, make sure you have:

1. A `.env` file with all required variables configured (see [SETUP.md](SETUP.md)).
2. A successful local test — run `pnpm dev` and verify the bot responds in Telegram.
3. Node.js 18+ installed on your server (unless using Docker).

---

## Option 1: Docker (Recommended)

The project includes a multi-stage Dockerfile that builds a minimal production image.

### Build and Run

```bash
docker build -t starkfi-bot .
docker run -d --name starkfi-bot --env-file .env --restart unless-stopped starkfi-bot
```

### Check Logs

```bash
docker logs -f starkfi-bot
```

### Stop and Remove

```bash
docker stop starkfi-bot
docker rm starkfi-bot
```

### Docker Compose

For easier management, create a `docker-compose.yml`:

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
docker compose up -d
docker compose logs -f
docker compose down
```

The `bot-data` volume persists the SQLite database and user session files across container restarts.

---

## Option 2: PM2

[PM2](https://pm2.keymetrics.io/) is a process manager with auto-restart, log management, and monitoring.

### Install PM2

```bash
npm install -g pm2
```

### Build and Start

```bash
pnpm build
pm2 start dist/index.js --name starkfi-bot
```

### Useful Commands

```bash
pm2 status              # process status
pm2 logs starkfi-bot    # tail logs
pm2 restart starkfi-bot # restart
pm2 stop starkfi-bot    # stop
pm2 delete starkfi-bot  # remove from PM2
```

### Auto-start on Boot

```bash
pm2 startup
pm2 save
```

PM2 generates a platform-specific command to register itself as a system service. Run the command it outputs— this ensures the bot restarts after server reboots.

### Ecosystem File (Optional)

Create `ecosystem.config.cjs` for more control:

```js
module.exports = {
  apps: [{
    name: "starkfi-bot",
    script: "dist/index.js",
    env: {
      NODE_ENV: "production",
    },
    max_memory_restart: "256M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
```

---

## Option 3: systemd

For servers running systemd (most Linux distributions).

### Build

```bash
pnpm build
```

### Create Service File

```bash
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

Adjust `User`, `WorkingDirectory`, and `EnvironmentFile` paths to match your setup.

### Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable starkfi-bot
sudo systemctl start starkfi-bot
```

### Manage

```bash
sudo systemctl status starkfi-bot   # check status
sudo journalctl -u starkfi-bot -f   # tail logs
sudo systemctl restart starkfi-bot  # restart
sudo systemctl stop starkfi-bot     # stop
```

---

## Production Checklist

Before going live, verify these items:

### Security

- [ ] `BOT_ENCRYPTION_SECRET` is a unique, randomly generated 64-char hex string.
- [ ] `.env` file is not committed to version control (listed in `.gitignore`).
- [ ] The bot process runs as a non-root user.
- [ ] The server has a firewall — the bot only needs outbound HTTPS (port 443) for Telegram and StarkFi APIs. No inbound ports are required (long polling mode).

### Reliability

- [ ] The process manager is configured to auto-restart on crash.
- [ ] The service starts automatically on server boot.
- [ ] Log output is captured and rotated (PM2 handles this; for systemd, journald rotates automatically).
- [ ] The SQLite database directory (`.data/`) is on persistent storage.

### Performance

- [ ] `NODE_ENV=production` is set (the Dockerfile does this automatically).
- [ ] `LOG_LEVEL` is set to `warn` or `error` in production to reduce disk I/O.
- [ ] `MCP_IDLE_TIMEOUT_MS` is tuned for your expected user activity — lower values free memory faster, higher values avoid MCP respawn latency.

---

## Updating

To deploy a new version:

```bash
git pull origin main
pnpm install
pnpm build

# Then restart using your chosen method:
docker compose up -d --build     # Docker
pm2 restart starkfi-bot          # PM2
sudo systemctl restart starkfi-bot  # systemd
```

---

## Troubleshooting

**Bot doesn't respond to messages:**
- Check that `TELEGRAM_BOT_TOKEN` is correct.
- Ensure no other instance of the bot is running — Telegram only allows one long-polling connection per token.
- Check logs for connection errors.

**"BOT_ENCRYPTION_SECRET must be a 64-character hex string":**
- Regenerate the secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- Make sure the value is exactly 64 characters (no spaces or newlines).

**MCP process fails to spawn:**
- Verify `npx starkfi mcp-start` works manually in the terminal.
- Check that the server has internet access for npx to download the package.
- Review debug logs (`LOG_LEVEL=debug`) for the spawn error.

**SQLite errors on container restart:**
- Make sure the `.data/` directory is mounted as a volume so it persists across container recreations.
