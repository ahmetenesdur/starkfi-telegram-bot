import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function startCommand(ctx: BotContext): Promise<void> {
	const name = ctx.from?.first_name ?? "there";

	await ctx.reply(
		`Hey ${name}, welcome to <b>StarkFi Bot</b>!\n\n` +
			"I'm your AI-powered DeFi assistant for <b>Starknet</b>. " +
			"Swap tokens, stake, lend, monitor positions, rebalance your portfolio, and simulate transactions — all through natural conversation.\n\n" +
			"<b>Get started in 3 steps:</b>\n" +
			"1. /setup — Choose your AI provider and model\n" +
			"2. /auth — Log in to your StarkFi account\n" +
			'3. Start chatting — try <i>"Show my portfolio"</i>\n\n' +
			"Need help? Use /help to see everything I can do.",
		{
			parse_mode: "HTML",
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
