# Bot Commands

## Setup Commands

### `/start`

Displays the welcome message and onboarding steps. Shows inline buttons for quick access to setup, auth, and help.

### `/setup`

Starts the AI model configuration flow:

1. User picks a provider (OpenAI, Claude, or Gemini).
2. User picks a model from the selected provider.
3. User sends their API key.
4. The key is encrypted and stored. The user's message containing the key is deleted.

### `/auth`

Logs in to StarkFi via email OTP:

1. User enters their email address.
2. StarkFi sends a verification code.
3. User enters the code.
4. Wallet address is saved and linked to the session.

### `/model`

Switches the AI model or provider. Shows the current provider and model, then:

- **Same provider:** Lists other available models. Switching does not require re-entering the API key.
- **Different provider:** Redirects to `/setup` for full reconfiguration (new key required).

## Session Commands

### `/status`

Displays current session state:

- AI provider and model name
- Wallet address (truncated)
- Conversation history length
- Active MCP process count

### `/help`

Lists all commands and shows example prompts for each capability (swaps, portfolio, staking, lending, batch ops).

### `/clear`

Resets conversation history for the current user. The AI will have no memory of previous messages.

### `/deletekey`

Removes the stored API key and ends the session. Also cleans up any active MCP process and auth state.

## Natural Language Capabilities

After setup and auth, the bot responds to natural language requests. Examples:

| Request | What Happens |
|---------|-------------|
| "What's my balance?" | Calls portfolio tool, returns token balances with USD values |
| "Swap 0.1 ETH to USDC" | Gets a quote from Fibrous, asks for confirmation, executes swap |
| "Stake 100 STRK" | Lists available validators, user picks one, executes staking |
| "Supply 0.5 ETH on Vesu" | Lists lending pools, user picks one, supplies collateral |
| "Send 50 USDC to 0x04a3..." | Asks for confirmation, executes transfer |
| "Swap 0.1 ETH to USDC and stake the STRK" | Batch operation — combines multiple actions |
