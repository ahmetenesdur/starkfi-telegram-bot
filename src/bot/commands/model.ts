import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { MODEL_OPTIONS, PROVIDER_LABELS } from "../../session/types.js";

export async function modelCommand(ctx: BotContext): Promise<void> {
	if (!ctx.userSession) {
		await ctx.reply("No AI model configured yet. Use /setup to get started.");
		return;
	}

	const session = ctx.userSession;
	const provider = session.provider;
	const models = MODEL_OPTIONS[provider];
	const currentModel = models.find((m) => m.id === session.modelName);

	const modelButtons = models
		.filter((m) => m.id !== session.modelName)
		.map((m) => [
			Markup.button.callback(`${m.label} — ${m.description}`, `switchmodel:${m.id}`),
		]);

	const changeProviderRow = [
		Markup.button.callback("Change Provider (requires new API key)", "action:setup"),
	];

	await ctx.reply(
		`<b>Switch Model</b>\n\n` +
			`Current: <b>${PROVIDER_LABELS[provider]}</b> — <code>${currentModel?.label ?? session.modelName}</code>\n\n` +
			(modelButtons.length > 0
				? "Choose a different model:"
				: "No other models available for this provider."),
		{
			parse_mode: "HTML",
			...Markup.inlineKeyboard([...modelButtons, changeProviderRow]),
		}
	);
}
