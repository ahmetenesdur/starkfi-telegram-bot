# Bot Commands

## Setup Commands

| Command      | Description                               |
| ------------ | ----------------------------------------- |
| `/start`     | Welcome message and onboarding steps      |
| `/setup`     | Configure AI provider, model, and API key |
| `/auth`      | Log in to StarkFi via email OTP           |
| `/model`     | Switch model or change provider           |

### `/setup` Flow

1. Pick a provider — OpenAI, Claude, or Gemini.
2. Pick a model from the provider's available options.
3. Send your API key — the bot encrypts it with AES-256-GCM and immediately deletes your message.

### `/auth` Flow

1. Enter your StarkFi account email.
2. Enter the verification code sent to your email.
3. Your Starknet wallet address is linked to the session.

### `/model` Behavior

- **Same provider:** Switch model without re-entering your API key.
- **Different provider:** Redirects to `/setup` (new key required).

## Session Commands

| Command      | Description                                     |
| ------------ | ----------------------------------------------- |
| `/status`    | View provider, model, wallet, and history count |
| `/help`      | List commands and example prompts               |
| `/clear`     | Reset conversation history                      |
| `/deletekey` | Remove stored API key and end session           |

## Available Models

| Provider   | Model ID                  | Label             | Description         |
| ---------- | ------------------------- | ----------------- | ------------------- |
| **OpenAI** | `gpt-5-mini`              | GPT-5 mini        | Fast & affordable   |
| **OpenAI** | `gpt-5.4`                 | GPT-5.4           | Most powerful        |
| **Claude** | `claude-haiku-4-5`        | Haiku 4.5         | Fast & cheap        |
| **Claude** | `claude-sonnet-4-6`       | Sonnet 4.6        | Balanced            |
| **Claude** | `claude-opus-4-6`         | Opus 4.6          | Most capable        |
| **Gemini** | `gemini-2.5-flash`        | Gemini 2.5 Flash  | Fast & affordable   |
| **Gemini** | `gemini-2.5-pro`          | Gemini 2.5 Pro    | Advanced reasoning  |
| **Gemini** | `gemini-3-flash-preview`  | Gemini 3 Flash    | Next-gen (preview)  |

## Natural Language

After setup and auth, send messages in any language. The AI handles the rest.

| Example                    | What Happens                                      |
| -------------------------- | ------------------------------------------------- |
| "What's my balance?"       | Returns token balances with USD values            |
| "Swap 0.1 ETH to USDC"    | Gets a quote, asks for confirmation, executes     |
| "Stake 100 STRK"          | Lists validators, user picks one, stakes          |
| "Supply 0.5 ETH on Vesu"  | Lists lending pools, user picks one, supplies     |
| "Send 50 USDC to 0x04a3…" | Confirms recipient, executes transfer             |
| "Swap + stake in one tx"  | Batch operation — multiple actions combined       |
| "Use gasless mode"        | Switches to ERC-20 gas payment via AVNU Paymaster |
