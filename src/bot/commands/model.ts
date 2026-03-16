import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { PROVIDER_LABELS } from "../../session/types.js";

export async function modelCommand(ctx: BotContext): Promise<void> {
	if (!ctx.userSession) {
		await ctx.reply("You haven't set up yet. Use /setup first.");
		return;
	}

	const current = ctx.userSession.provider;

	await ctx.reply(
		`*Switch AI Model*\n\n` +
			`Current: *${PROVIDER_LABELS[current]}* (\`${ctx.userSession.modelName}\`)\n\n` +
			"Choose a new provider (you'll need to enter the API key for the new provider):",
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
