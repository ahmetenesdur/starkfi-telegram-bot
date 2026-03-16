# StarkFi Telegram Bot

AI-powered Telegram bot for StarkFi DeFi on Starknet. Users choose their own AI model (OpenAI, Claude, or Gemini) and provide their own API key — no shared keys, no centralized AI billing.

## What It Does

- **Token Swaps** — Natural language trading via Fibrous DEX aggregator
- **Staking** — Multi-token staking (STRK, WBTC, tBTC, SolvBTC, LBTC) across validators
- **Lending** — Vesu V2: supply, borrow, repay, withdraw, close positions
- **Portfolio** — Wallet balances with USD valuations and position health
- **Batch Operations** — Combine swap + stake + supply + send in one transaction
- **Gas Abstraction** — Gasfree (sponsored) and gasless (ERC-20 fee) modes

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/ahmetenesdur/starkfi-telegram-bot.git
cd starkfi-telegram-bot
pnpm install

# 2. Configure (see docs/SETUP.md for details)
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, STARKFI_SERVER_URL

# 3. Run
pnpm dev
```

For production deployment, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

| Document | Contents |
|----------|----------|
| [Setup Guide](docs/SETUP.md) | Environment variables, BotFather setup, configuration reference |
| [Deployment Guide](docs/DEPLOYMENT.md) | Docker, PM2, systemd, production checklist |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, security model |
| [Bot Commands](docs/COMMANDS.md) | Complete command and capability reference |

## Requirements

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An API key from at least one AI provider (OpenAI, Claude, or Gemini)

## License

MIT
