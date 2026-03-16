import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { MODEL_DEFAULTS, PROVIDER_LABELS, type Provider } from "../../session/types.js";

export async function setupCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*AI Model Setup*\n\n" +
			"Choose your AI provider. You'll need an API key from the provider's dashboard.\n\n" +
			"Each provider has strengths:\n" +
			"• *OpenAI* — GPT-4o, fast and reliable\n" +
			"• *Claude* — Anthropic, great at reasoning\n" +
			"• *Gemini* — Google, strong multimodal",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("OpenAI (GPT-4o)", "setup:openai")],
				[Markup.button.callback("Claude (Anthropic)", "setup:claude")],
				[Markup.button.callback("Gemini (Google)", "setup:gemini")],
			]),
		}
	);
}

export async function handleProviderSelection(ctx: BotContext, provider: Provider): Promise<void> {
	const label = PROVIDER_LABELS[provider];
	const model = MODEL_DEFAULTS[provider];

	ctx.store.setAuthState(
		ctx.from!.id.toString(),
		JSON.stringify({
			step: "awaiting_api_key",
			provider,
		})
	);

	await ctx.editMessageText(
		`Selected: *${label}*\n` +
			`Default model: \`${model}\`\n\n` +
			"Now send me your API key.\n\n" +
			"_Your key is encrypted with AES-256-GCM and never stored in plain text._",
		{ parse_mode: "Markdown" }
	);
}

export async function handleApiKeyInput(
	ctx: BotContext,
	provider: Provider,
	apiKey: string
): Promise<void> {
	const userId = ctx.from!.id.toString();
	const modelName = MODEL_DEFAULTS[provider];

	ctx.store.upsert(userId, provider, apiKey, modelName);
	ctx.store.clearAuthState(userId);

	// Delete user's message containing the plain-text API key
	try {
		await ctx.deleteMessage();
	} catch {
		/* message may already be deleted */
	}

	await ctx.reply(
		"*Setup Complete*\n\n" +
			`• Provider: *${PROVIDER_LABELS[provider]}*\n` +
			`• Model: \`${modelName}\`\n\n` +
			"Next step: Use /auth to connect your StarkFi wallet.\n" +
			'Or just start chatting — try: _"What can you do?"_',
		{ parse_mode: "Markdown" }
	);
}
