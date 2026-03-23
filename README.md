# StarkFi Telegram Bot

AI-powered Telegram bot for [StarkFi](https://starkfi.app) DeFi on Starknet. Each user brings their own AI model and API key — no shared keys, no centralized billing.

## Features

- **Swap** — DEX-aggregated trading via Fibrous
- **Stake** — Multi-token staking (STRK, WBTC, tBTC, SolvBTC, LBTC)
- **Lend** — Supply, borrow, repay, withdraw, close on Vesu V2
- **Monitor** — Real-time lending health factor alerts with 4-level risk system
- **Auto-Rebalance** — Automatically fix unhealthy lending positions
- **Portfolio** — Balances with USD valuations and position health
- **Rebalance** — Optimize portfolio allocation via batch swaps
- **Batch** — Combine multiple operations in a single atomic transaction
- **Gas Abstraction** — Gasless (pay in ERC-20) and gasfree (developer-sponsored) via AVNU Paymaster

## AI Providers

| Provider   | Models                                                   |
| ---------- | -------------------------------------------------------- |
| **OpenAI** | GPT-5 mini, GPT-5.4                                      |
| **Claude** | Haiku 4.5, Sonnet 4.6, Opus 4.6                          |
| **Gemini** | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3 Flash Preview |

## Quick Start

```bash
git clone https://github.com/ahmetenesdur/starkfi-telegram-bot.git
cd starkfi-telegram-bot

# Install and configure
pnpm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, STARKFI_SERVER_URL

pnpm dev
```

## Documentation

| Document                             | What's Inside                                   |
| ------------------------------------ | ----------------------------------------------- |
| [Setup](docs/SETUP.md)               | BotFather setup, environment variables, scripts |
| [Commands](docs/COMMANDS.md)         | All bot commands and natural language examples  |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, security model        |
| [Deployment](docs/DEPLOYMENT.md)     | Docker, Railway, production checklist           |

## Requirements

- Node.js 18+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- API key from OpenAI, Anthropic, or Google

## License

MIT
