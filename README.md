# StarkFi Telegram Bot

AI-powered Telegram bot for [StarkFi](https://starkfi.app) DeFi on Starknet. Swap, stake, lend, batch, DCA, vault strategies, liquid staking, and confidential transfers — all through natural conversation. Each user brings their own AI model and API key — no shared keys, no centralized billing.

## How It Works

```
You (Telegram) → AI Model (your key) → StarkFi MCP Server → Starknet
```

Each user gets a dedicated MCP child process with isolated credentials. No cross-contamination between users.

## Features

| Feature | Description |
| --- | --- |
| **Swap** | Token trading via Fibrous, AVNU, or Ekubo (`--provider auto` races all) |
| **Stake** | Delegation staking (STRK, WBTC, tBTC, SolvBTC, LBTC) across validators |
| **Liquid Stake** | Endur liquid staking — stake STRK → xSTRK (auto-yield via share price) |
| **Troves** | DeFi yield vaults — list strategies, deposit, withdraw, check positions |
| **Lend** | Supply, borrow, repay, withdraw, close, monitor, auto-rebalance on Vesu V2 |
| **DCA** | Recurring buy orders via AVNU and Ekubo |
| **Confidential** | Privacy-preserving transfers via Tongo Cash (ZK proofs) |
| **Batch** | Combine swap + stake + lend + send + DCA + troves in one atomic transaction |
| **Portfolio** | Balances with USD values, staking, lending, vault, and LST positions |
| **Gas Modes** | Gasless (pay in ERC-20) and gasfree (developer-sponsored) |

## Bot Commands

| Command | Description |
| --- | --- |
| `/start` | Welcome and onboarding |
| `/setup` | Configure AI provider, model, and API key |
| `/auth` | Log in via email OTP |
| `/model` | Switch AI model or provider |
| `/status` | View provider, model, wallet, history |
| `/help` | List commands and example prompts |
| `/clear` | Reset conversation history |
| `/deletekey` | Remove stored API key |

After setup, just chat naturally — *"Swap 0.1 ETH to USDC"*, *"Stake 100 STRK"*, *"Show my portfolio"*.

## AI Providers

| Provider | Models |
| --- | --- |
| **OpenAI** | GPT-5.4 Nano, GPT-5.4 Mini, GPT-5.4 |
| **Claude** | Haiku 4.5, Sonnet 4.6, Opus 4.6 |
| **Gemini** | 3.1 Flash-Lite, 3 Flash, 2.5 Flash, 2.5 Pro, 3.1 Pro Preview |

## Quick Start

```bash
git clone https://github.com/ahmetenesdur/starkfi-telegram-bot.git
cd starkfi-telegram-bot

pnpm install
cp .env.example .env
# Fill in: TELEGRAM_BOT_TOKEN, BOT_ENCRYPTION_SECRET, STARKFI_SERVER_URL

pnpm dev
```

## Documentation

| Document | Content |
| --- | --- |
| [Setup](docs/SETUP.md) | BotFather setup, environment variables, scripts |
| [Commands](docs/COMMANDS.md) | All bot commands and natural language examples |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, security model |
| [Deployment](docs/DEPLOYMENT.md) | Docker, Railway, production checklist |

## Security

- API keys encrypted with **AES-256-GCM** at rest
- Messages containing keys are **auto-deleted** from Telegram
- Per-user **MCP process isolation** (separate XDG home)
- **5-message burst** rate limiting (1 token/sec refill)

→ **[Security Architecture](https://docs.starkfi.app/docs/architecture/security)**

## Requirements

- Node.js 18+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- API key from OpenAI, Anthropic, or Google

## See Also

- **[Telegram Bot Docs](https://docs.starkfi.app/docs/integrations/telegram-bot)** — Full integration guide
- **[MCP Server](https://docs.starkfi.app/docs/mcp)** — Underlying protocol powering the bot
- **[StarkFi CLI](https://github.com/ahmetenesdur/starkfi)** — Main project repository

## License

MIT
