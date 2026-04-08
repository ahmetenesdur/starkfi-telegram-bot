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

| Example                                         | What Happens                                            |
| ----------------------------------------------- | ------------------------------------------------------- |
| "What's my balance?"                             | Returns token balances with USD values                  |
| "Swap 0.1 ETH to USDC"                          | Gets a quote, asks for confirmation, executes           |
| "Stake 100 STRK"                                 | Lists validators, user picks one, stakes                |
| "Supply 0.5 ETH on Vesu"                         | Lists lending pools, user picks one, supplies           |
| "Borrow 100 USDC and swap to STRK"               | Batch operation combining lending borrow and token swap |
| "Repay my STRK debt"                             | Repays open borrow positions on the specified asset     |
| "Send 50 USDC to 0x04a3…"                        | Confirms recipient, executes transfer                   |
| "Check my lending positions"                     | Monitors all positions with health factor and risk      |
| "My health factor is low, fix it"                | Simulates auto-rebalance, asks for confirmation         |
| "Rebalance to 50% ETH, 30% USDC, 20% STRK"     | Calculates optimal trades, previews, then executes      |
| "Swap + stake in one tx"                         | Batch operation — multiple actions combined              |
| "Use gasless mode"                               | Switches to ERC-20 gas payment via AVNU Paymaster       |
| "Buy 10 USDC of ETH every day for 100 days"     | Previews DCA, asks for confirmation, creates order       |
| "Show my active DCA orders"                      | Lists all active DCA orders with status                  |
| "Fund 100 USDC to my confidential account"       | Funds public tokens into private balance                 |
| "Send 50 privately to this public key"            | Private transfer via ZK proof                            |
| "Withdraw from my confidential account"           | Converts private balance back to public                  |

---

## See Also

- **[Architecture](ARCHITECTURE.md)** — System design, data flow, AI error handling
- **[StarkFi CLI Reference](https://docs.starkfi.app/docs/cli)** — Full CLI command reference
- **[MCP Tools](https://docs.starkfi.app/docs/mcp)** — The 42 MCP tools the bot uses internally

