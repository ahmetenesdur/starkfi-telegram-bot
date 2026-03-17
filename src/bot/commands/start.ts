import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function startCommand(ctx: BotContext): Promise<void> {
	const name = ctx.from?.first_name ?? "there";

	await ctx.reply(
		`Hey ${name}, welcome to *StarkFi Bot*!\n\n` +
			"I'm your AI-powered DeFi assistant for *Starknet*. " +
			"Swap tokens, stake, lend, and manage your portfolio — all through natural conversation.\n\n" +
			"*Get started in 3 steps:*\n" +
			"1. /setup — Choose your AI provider and model\n" +
			"2. /auth — Log in to your StarkFi account\n" +
			'3. Start chatting — try _"What\'s my balance?"_\n\n' +
			"Need help? Use /help to see everything I can do.",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("Setup AI Model", "action:setup")],
				[Markup.button.callback("Log In to StarkFi", "action:auth")],
				[
					Markup.button.callback("Help", "action:help"),
					Markup.button.callback("About StarkFi", "action:about"),
				],
			]),
		}
	);
}
