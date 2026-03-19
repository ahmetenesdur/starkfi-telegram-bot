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
