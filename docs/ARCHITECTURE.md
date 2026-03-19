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

```
src/
├── index.ts              # Entry point — config, store, pool, bot, shutdown
├── lib/
│   ├── config.ts          # Zod-validated environment variable loading
│   ├── logger.ts          # Structured JSON logger with level filtering
│   └── format.ts          # Telegram message chunking and Markdown escaping
├── session/
│   ├── types.ts           # Session, auth state, provider, and model definitions
│   ├── crypto.ts          # AES-256-GCM encryption for API keys at rest
│   └── store.ts           # SQLite store (WAL mode, prepared statements, auto-migration)
├── mcp/
│   ├── client.ts          # Spawns StarkFi MCP child process via stdio transport
│   └── pool.ts            # Per-user process lifecycle with idle cleanup
├── ai/
│   ├── providers.ts       # Creates AI SDK model instance per provider
│   ├── router.ts          # Sends messages + MCP tools to AI, handles errors
│   └── system-prompt.ts   # Defines bot behavior, rules, and constraints
├── auth/
│   └── starkfi-auth.ts    # Email/OTP login and session file management
└── bot/
    ├── bot.ts             # Telegraf setup, middleware stack, command registration
    ├── middleware/
    │   ├── session.ts     # Loads user session from SQLite per request
    │   ├── rate-limit.ts  # Token-bucket rate limiting per user
    │   └── queue.ts       # Per-user message queue (serializes requests)
    ├── commands/
    │   ├── start.ts       # /start — welcome and onboarding
    │   ├── setup.ts       # /setup — provider, model, API key config
    │   ├── auth.ts        # /auth — StarkFi email OTP authentication
    │   ├── model.ts       # /model — switch model or provider
    │   ├── status.ts      # /status — session info dashboard
    │   ├── help.ts        # /help — command reference
    │   ├── clear.ts       # /clear — reset conversation history
    │   └── deletekey.ts   # /deletekey — remove API key and end session
    └── handlers/
        ├── callback.ts    # Inline keyboard callback query handler
        └── message.ts     # Natural language text message processing
```

## Security Model

### API Key Encryption

User API keys are encrypted with **AES-256-GCM** before storage in SQLite. The key is derived from `BOT_ENCRYPTION_SECRET` (32 bytes). Keys are decrypted only at the moment of an AI request and never held in memory longer than necessary. Messages containing API keys are deleted from the Telegram chat after processing.

### Per-User Isolation

Each user gets a dedicated MCP child process with an isolated `HOME` directory (`.data/users/{userId}/`):

- Separate StarkFi session files per user
- No cross-contamination of wallet credentials
- Independent process lifecycle — one user's crash doesn't affect others

### Rate Limiting

Token-bucket rate limiting with configurable per-minute limit (default: 30). Stale buckets are automatically pruned after 1 hour of inactivity to prevent memory leaks.

### Message Queue

A per-user message queue serializes AI requests to prevent race conditions when a user sends multiple messages in quick succession.

## Data Flows

### Setup Flow

```
/setup → provider selection → model selection → API key input
       → encrypt key → store in SQLite → delete user's key message
```

### Message Flow

```
Text message → load session → rate limit check → queue request
            → decrypt key → get/spawn MCP client → generateText()
            → AI may call MCP tools → chunk response → send to Telegram
            → save updated history (trimmed to MAX_HISTORY)
```

### Auth Flow

```
/auth → email input → requestLogin() → OTP input → verifyOtp()
      → write session.json to user's HOME dir → kill old MCP process
```

## AI Error Handling

The AI router (`router.ts`) catches and classifies provider errors into user-friendly messages:

| Error Category | Detection                                      | User Message                                  |
| -------------- | ---------------------------------------------- | --------------------------------------------- |
| Auth error     | HTTP 401/403, "invalid api key"                | "API key is invalid. Use /setup for a new key" |
| Rate limit     | HTTP 429, "too many requests"                   | "Rate limit exceeded — wait and retry"        |
| Quota          | "insufficient_quota", "billing"                 | "API quota exhausted. Check billing."         |
| Content filter | "safety", "blocked", "content filter"           | "Message blocked by content policy."          |
| Model missing  | HTTP 404, "model not found"                     | "Model unavailable. Use /model to switch."    |
| Timeout        | "timeout", "econnrefused", "fetch failed"       | "Service unavailable. Try again."             |
| Server error   | HTTP 5xx                                        | "Provider server issues. Try later."          |

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
| `zod`               | Schema validation for config          |
