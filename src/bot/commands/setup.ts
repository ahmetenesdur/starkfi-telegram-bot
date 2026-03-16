import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import {
	MODEL_DEFAULTS,
	MODEL_OPTIONS,
	PROVIDER_LABELS,
	type Provider,
} from "../../session/types.js";

export async function setupCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*AI Model Setup*\n\n" +
			"Choose your AI provider. You'll need an API key from the provider's dashboard.\n\n" +
			"• *OpenAI* — Fast, reliable, great tool use\n" +
			"• *Claude* — Excellent reasoning and analysis\n" +
			"• *Gemini* — Strong multimodal capabilities",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("OpenAI", "setup:openai")],
				[Markup.button.callback("Claude", "setup:claude")],
				[Markup.button.callback("Gemini", "setup:gemini")],
			]),
		}
	);
}

export async function handleProviderSelection(ctx: BotContext, provider: Provider): Promise<void> {
	const label = PROVIDER_LABELS[provider];
	const models = MODEL_OPTIONS[provider];

	const buttons = models.map((m) =>
		Markup.button.callback(`${m.label} — ${m.description}`, `setupmodel:${provider}:${m.id}`)
	);

	await ctx.editMessageText(`Selected: *${label}*\n\n` + "Now choose a model:", {
		parse_mode: "Markdown",
		...Markup.inlineKeyboard(buttons.map((b) => [b])),
	});
}

export async function handleModelSelection(
	ctx: BotContext,
	provider: Provider,
	modelId: string
): Promise<void> {
	const models = MODEL_OPTIONS[provider];
	const model = models.find((m) => m.id === modelId);
	const label = PROVIDER_LABELS[provider];
	const modelLabel = model?.label ?? modelId;

	ctx.store.setAuthState(
		ctx.from!.id.toString(),
		JSON.stringify({
			step: "awaiting_api_key",
			provider,
			modelId,
		})
	);

	await ctx.editMessageText(
		`*${label}* → \`${modelLabel}\`\n\n` +
			"Now send me your API key.\n\n" +
			"_Your key is encrypted with AES-256-GCM and never stored in plain text._",
		{ parse_mode: "Markdown" }
	);
}

export async function handleApiKeyInput(
	ctx: BotContext,
	provider: Provider,
	apiKey: string,
	modelName?: string
): Promise<void> {
	const userId = ctx.from!.id.toString();
	const finalModel = modelName ?? MODEL_DEFAULTS[provider];

	ctx.store.upsert(userId, provider, apiKey, finalModel);
	ctx.store.clearAuthState(userId);

	// Delete the message containing the plain-text key
	try {
		await ctx.deleteMessage();
	} catch {
		/* message may already be deleted */
	}

	const models = MODEL_OPTIONS[provider];
	const model = models.find((m) => m.id === finalModel);

	await ctx.reply(
		"*Setup Complete* ✓\n\n" +
			`• Provider: *${PROVIDER_LABELS[provider]}*\n` +
			`• Model: \`${model?.label ?? finalModel}\`\n\n` +
			"Next step: Use /auth to log in to your StarkFi account.\n" +
			'Or just start chatting — try: _"What can you do?"_',
		{ parse_mode: "Markdown" }
	);
}
