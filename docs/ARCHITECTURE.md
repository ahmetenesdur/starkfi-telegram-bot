# Architecture

## Overview

The bot connects Telegram users to Starknet DeFi through AI. Each user provides their own AI API key. The bot routes natural language requests through the AI model to StarkFi's MCP server, which executes on-chain operations.

```
Telegram User
    │
    ▼
Telegraf (Bot Framework)
    │
    ├── Middleware: session → rate-limit → message-queue
    │
    ├── Commands: /start, /setup, /auth, /model, /status, /help, /clear, /deletekey
    │
    └── Message Handler
            │
            ▼
        AI Router (Vercel AI SDK)
            │
            ├── Provider: OpenAI / Anthropic / Google
            │
            └── Tools: StarkFi MCP Client
                    │
                    ▼
                StarkFi MCP Server (per-user process)
                    │
                    ▼
                Starknet Blockchain
```

## Project Structure

### `src/lib/` — Core Infrastructure

| File        | Purpose                                         |
| ----------- | ----------------------------------------------- |
| `config.ts` | Environment variable loading and validation     |
| `logger.ts` | Structured JSON logger with level filtering     |
| `format.ts` | Telegram message chunking and Markdown escaping |

### `src/session/` — Session Layer

| File        | Purpose                                                   |
| ----------- | --------------------------------------------------------- |
| `types.ts`  | Session, auth state, and provider type definitions        |
| `crypto.ts` | AES-256-GCM encryption for API keys at rest               |
| `store.ts`  | SQLite store with WAL mode and prepared statement caching |

### `src/mcp/` — MCP Layer

| File        | Purpose                                              |
| ----------- | ---------------------------------------------------- |
| `client.ts` | Spawns StarkFi MCP child process via stdio transport |
| `pool.ts`   | Per-user process lifecycle with idle cleanup         |

### `src/ai/` — AI Layer

| File               | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `providers.ts`     | Creates the appropriate AI SDK model instance      |
| `router.ts`        | Sends user messages + MCP tools to the AI model    |
| `system-prompt.ts` | Defines the bot's behavior, rules, and constraints |

### `src/auth/` — Authentication

| File              | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `starkfi-auth.ts` | Email/OTP login and session file management |

### `src/bot/` — Bot Core

| File          | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `bot.ts`      | Telegraf setup, middleware stack, command registration |
| `middleware/` | Session loading, rate limiting, message queue          |
| `commands/`   | Individual command handlers                            |
| `handlers/`   | Callback queries and text message processing           |

## Security Model

### API Key Encryption

User API keys are encrypted with AES-256-GCM before storage in SQLite. The key is derived from `BOT_ENCRYPTION_SECRET` (32 bytes). Keys are decrypted only at the moment of an AI request and never held in memory longer than necessary.

### Per-User Isolation

Each user gets a dedicated MCP child process with an isolated `HOME` directory (`.data/users/{userId}/`). This ensures:

- Separate StarkFi session files per user
- No cross-contamination of wallet credentials
- Independent process lifecycle — one user's crash doesn't affect others

### Message Security

- Messages containing API keys are deleted after processing
- Token-bucket rate limiting prevents abuse
- A per-user message queue serializes requests to prevent race conditions

## Data Flows

### Setup Flow

```
/setup → provider selection → model selection → API key input
       → encrypt key → store in SQLite → delete user's key message
```

### Message Flow

```
Text message → load session → rate limit check → queue request
            → decrypt key → get/spawn MCP client → generateText
            → AI responds (may call MCP tools) → chunk response → send
            → save updated history
```

### Auth Flow

```
/auth → email input → requestLogin() → OTP input → verifyOtp()
      → write session.json to user's HOME → kill old MCP process
```

## Dependencies

| Package             | Purpose                               |
| ------------------- | ------------------------------------- |
| `telegraf`          | Telegram Bot API framework            |
| `ai`                | Vercel AI SDK — unified LLM interface |
| `@ai-sdk/mcp`       | MCP client for AI SDK                 |
| `@ai-sdk/openai`    | OpenAI provider                       |
| `@ai-sdk/anthropic` | Anthropic (Claude) provider           |
| `@ai-sdk/google`    | Google (Gemini) provider              |
| `better-sqlite3`    | SQLite driver for session storage     |
