# StarkFi Telegram Bot

AI-powered Telegram bot for [StarkFi](https://starkfi.app) DeFi on Starknet. Users bring their own AI model — OpenAI, Claude, or Gemini — and their own API key. No shared keys, no centralized billing.

## Features

- **Swap** — DEX-aggregated trading via Fibrous
- **Stake** — Multi-token staking (STRK, WBTC, tBTC, SolvBTC, LBTC)
- **Lend** — Supply, borrow, repay, withdraw, close on Vesu V2
- **Portfolio** — Balances with USD valuations and position health
- **Batch** — Combine swap + stake + supply + send in one transaction
- **Gas Modes** — Gasless (pay in ERC-20) and gasfree (developer-sponsored) via AVNU Paymaster

## Quick Start

```bash
git clone https://github.com/ahmetenesdur/starkfi-telegram-bot.git
cd starkfi-telegram-bot
pnpm install

cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, STARKFI_SERVER_URL

pnpm dev
```

See [docs/SETUP.md](docs/SETUP.md) for full configuration and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production.

## Docs

| Document                             | Description                                     |
| ------------------------------------ | ----------------------------------------------- |
| [Setup](docs/SETUP.md)               | Environment variables, BotFather setup, scripts |
| [Deployment](docs/DEPLOYMENT.md)     | Docker, App Runner, PM2, systemd, production checklist |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, security model        |
| [Commands](docs/COMMANDS.md)         | Bot commands and natural language reference     |

## Requirements

- Node.js 18+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- API key from OpenAI, Anthropic, or Google

## License

MIT
