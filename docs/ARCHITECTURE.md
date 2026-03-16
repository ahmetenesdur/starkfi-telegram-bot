# Architecture

## Overview

The bot bridges Telegram users to Starknet DeFi through AI. Each user provides their own AI model API key, and the bot routes natural language requests through the AI to StarkFi's MCP server.

```
Telegram User
    |
    v
Telegraf (Bot Framework)
    |
    ├── Middleware: session → rate-limit → auth-guard
    |
    ├── Commands: /start, /setup, /auth, /model, /status, /help, /clear, /deletekey
    |
    └── Message Handler
            |
            v
        AI Router (Vercel AI SDK)
            |
            ├── Provider: OpenAI / Anthropic / Google
            |
            └── Tools: MCP Client
                    |
                    v
                StarkFi MCP Server (per-user child process)
                    |
                    v
                Starknet Blockchain
```

## Layers

### Core Infrastructure (`src/lib/`)

- **config.ts** — Environment variable loading and validation.
- **logger.ts** — Structured JSON logger with level filtering.
- **format.ts** — Telegram message chunking and Markdown escaping.

### Session Layer (`src/session/`)

- **types.ts** — Session, auth state, and provider type definitions.
- **crypto.ts** — AES-256-GCM encryption/decryption for API keys at rest.
- **store.ts** — SQLite-backed session store using better-sqlite3 with WAL mode.

### MCP Layer (`src/mcp/`)

- **client.ts** — Spawns a StarkFi MCP child process via `Experimental_StdioMCPTransport`.
- **pool.ts** — Manages per-user MCP process lifecycle with idle timeouts and cleanup.

### AI Layer (`src/ai/`)

- **providers.ts** — Factory function that creates the appropriate AI SDK model instance.
- **router.ts** — Sends user messages + MCP tools to the AI, returns the response.
- **system-prompt.ts** — The system prompt defining the bot's behavior and constraints.

### Authentication (`src/auth/`)

- **starkfi-auth.ts** — StarkFi email/OTP login flow and session file management.

### Bot Core (`src/bot/`)

- **bot.ts** — Telegraf instance setup, middleware stack, command registration.
- **middleware/** — Session loading, rate limiting, message queue.
- **commands/** — Individual command handlers (start, setup, auth, model, etc.).
- **handlers/** — Callback query routing and text message processing.

## Security Model

### API Key Storage

User API keys are encrypted with AES-256-GCM before storage in SQLite. The encryption secret is a 32-byte key derived from `BOT_ENCRYPTION_SECRET`. Keys are decrypted only at the moment of an AI request and never held in memory longer than necessary.

### Per-User Isolation

Each user gets a dedicated MCP child process running with an isolated `HOME` directory (`/.data/users/{userId}/`). This ensures:

- Separate StarkFi session files per user.
- No cross-contamination of wallet credentials between users.
- Independent process lifecycle — one user's crash doesn't affect others.

### Message Security

- Messages containing API keys are deleted from the chat after processing.
- Rate limiting prevents abuse (configurable per-minute limit).
- A message queue serializes per-user requests to prevent race conditions.

## Data Flow

### Setup Flow

```
User sends /setup
  → Bot shows provider selection (inline keyboard)
  → User picks provider (callback query)
  → Bot asks for API key
  → User sends API key
  → Bot encrypts key, stores in SQLite, deletes user's message
```

### Message Flow

```
User sends a text message
  → Session middleware loads user session from SQLite
  → Rate limiter checks and decrements token bucket
  → Auth guard verifies session exists
  → Message queue serializes the request
  → AI Router: decrypt API key, get/spawn MCP client, call generateText
  → AI responds (may invoke MCP tools for on-chain operations)
  → Bot sends chunked response back to Telegram
  → Updated history saved to SQLite
```

### Auth Flow (StarkFi Wallet)

```
User sends /auth
  → Bot asks for email
  → User sends email → requestLogin() calls StarkFi API
  → Bot asks for OTP
  → User sends code → verifyOtp() returns wallet address + token
  → Bot writes session.json to user's isolated HOME
  → Existing MCP process killed so next request spawns with new credentials
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `telegraf` | Telegram Bot API framework |
| `ai` | Vercel AI SDK — unified LLM interface |
| `@ai-sdk/mcp` | MCP client integration for AI SDK |
| `@ai-sdk/openai` | OpenAI provider adapter |
| `@ai-sdk/anthropic` | Anthropic (Claude) provider adapter |
| `@ai-sdk/google` | Google (Gemini) provider adapter |
| `better-sqlite3` | SQLite driver for session storage |
