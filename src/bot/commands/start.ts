import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function startCommand(ctx: BotContext): Promise<void> {
	const name = ctx.from?.first_name ?? "there";

	await ctx.reply(
		`Welcome to *StarkFi Bot*, ${name}!\n\n` +
			"I'm your AI-powered DeFi assistant for *Starknet*. " +
			"I can help you swap tokens, stake, lend, and manage your portfolio — all through natural language.\n\n" +
			"*Getting Started:*\n" +
			"1. Use /setup to choose your AI model and enter your API key\n" +
			"2. Use /auth to connect your StarkFi wallet\n" +
			'3. Start chatting! Try: _"What\'s my balance?"_\n\n' +
			"Use /help to see all available commands.",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("Setup AI Model", "action:setup")],
				[Markup.button.callback("Connect Wallet", "action:auth")],
				[Markup.button.callback("Help", "action:help")],
			]),
		}
	);
}
