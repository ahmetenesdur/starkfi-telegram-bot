import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { MODEL_OPTIONS, PROVIDER_LABELS } from "../../session/types.js";

export async function modelCommand(ctx: BotContext): Promise<void> {
	if (!ctx.userSession) {
		await ctx.reply("You haven't set up yet. Use /setup first.");
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
		Markup.button.callback("Change Provider (new key required)", "action:setup"),
	];

	await ctx.reply(
		`*Switch Model*\n\n` +
			`Current: *${PROVIDER_LABELS[provider]}* → \`${currentModel?.label ?? session.modelName}\`\n\n` +
			(modelButtons.length > 0
				? "Switch to a different model:"
				: "No other models available for this provider."),
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([...modelButtons, changeProviderRow]),
		}
	);
}
