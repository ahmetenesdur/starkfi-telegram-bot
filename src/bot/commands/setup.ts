import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import {
	MODEL_DEFAULTS,
	MODEL_OPTIONS,
	PROVIDER_LABELS,
	type Provider,
} from "../../session/types.js";
import { encrypt } from "../../session/crypto.js";

export async function setupCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"<b>AI Model Setup</b>\n\n" +
			"Choose your AI provider. You'll need an API key from the provider's dashboard.\n\n" +
			"• <b>OpenAI</b> — Fast and reliable, great tool use\n" +
			"• <b>Claude</b> — Strong reasoning and analysis\n" +
			"• <b>Gemini</b> — Powerful multimodal capabilities",
		{
			parse_mode: "HTML",
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

	await ctx.editMessageText(`Provider: <b>${label}</b>\n\nNow choose a model:`, {
		parse_mode: "HTML",
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

	const userId = ctx.from?.id?.toString();
	if (!userId) return;

	ctx.store.setAuthState(
		userId,
		JSON.stringify({
			step: "awaiting_api_key",
			provider,
			modelId,
		})
	);

	await ctx.editMessageText(
		`<b>${label}</b> — <code>${modelLabel}</code>\n\n` +
			"Send me your API key.\n\n" +
			"<i>Your key is encrypted with AES-256-GCM and never stored in plain text.</i>",
		{ parse_mode: "HTML" }
	);
}

export async function handleApiKeyInput(
	ctx: BotContext,
	provider: Provider,
	apiKey: string,
	modelName?: string
): Promise<void> {
	const userId = ctx.from?.id?.toString();
	if (!userId) return;
	const finalModel = modelName ?? MODEL_DEFAULTS[provider];

	const encryptedKey = encrypt(apiKey, ctx.encryptionSecret);
	ctx.store.upsert(userId, provider, encryptedKey, finalModel);
	ctx.store.clearAuthState(userId);

	try {
		await ctx.deleteMessage();
	} catch {
		/* message may already be deleted */
	}

	const models = MODEL_OPTIONS[provider];
	const model = models.find((m) => m.id === finalModel);

	await ctx.reply(
		"<b>Setup Complete</b>\n\n" +
			`Provider: <b>${PROVIDER_LABELS[provider]}</b>\n` +
			`Model: <code>${model?.label ?? finalModel}</code>\n\n` +
			"Next step: Use /auth to log in to your StarkFi account.\n" +
			'Or just start chatting — try <i>"What can you do?"</i>',
		{
			parse_mode: "HTML",
			...Markup.inlineKeyboard([Markup.button.callback("Log In to StarkFi", "action:auth")]),
		}
	);
}
