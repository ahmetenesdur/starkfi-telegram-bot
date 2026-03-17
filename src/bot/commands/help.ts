import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function helpCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*StarkFi Bot — Help*\n\n" +
			"*Setup*\n" +
			"• /setup — Choose your AI provider, model, and API key\n" +
			"• /auth — Log in to your StarkFi account\n" +
			"• /model — Switch AI model or change provider\n" +
			"• /status — View your current session (provider, model, wallet)\n\n" +
			"*Session*\n" +
			"• /clear — Reset conversation history\n" +
			"• /deletekey — Remove your stored API key\n\n" +
			"*What I can do:*\n" +
			'• Token swaps — _"Swap 0.1 ETH to USDC"_\n' +
			'• Multi-swap — _"Swap ETH to STRK and USDC"_\n' +
			'• Portfolio — _"Show my balance"_\n' +
			'• Staking — _"Stake 100 STRK on Karnot"_\n' +
			'• Lending — _"Supply 0.5 ETH on Vesu"_\n' +
			'• Batch operations — _"Swap + stake in one tx"_\n' +
			'• Gas abstraction — _"Use gasless mode"_\n\n' +
			"Just describe what you want — in any language!",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[Markup.button.callback("About StarkFi", "action:about")],
				[Markup.button.url("Website", "https://starkfi.app")],
				[Markup.button.url("Documentation", "https://docs.starkfi.app/docs")],
			]),
		}
	);
}
