## 2024-05-24 - Telegram Inline Buttons for Onboarding
**Learning:** Text-only instructions (like "Use /setup") in Telegram bots cause friction because users must manually type or click the slash command.
**Action:** Always use inline buttons (`Markup.button.callback`) for next steps in onboarding and error recovery flows to reduce friction and make the interface more intuitive.