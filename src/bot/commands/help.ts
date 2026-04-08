import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function helpCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"<b>StarkFi Bot — Help</b>\n\n" +
			"<b>Setup</b>\n" +
			"• /setup — Choose your AI provider, model, and API key\n" +
			"• /auth — Log in to your StarkFi account\n" +
			"• /model — Switch AI model or change provider\n" +
			"• /status — View your current session (provider, model, wallet)\n\n" +
			"<b>Session</b>\n" +
			"• /clear — Reset conversation history\n" +
			"• /cancel — Stop the current AI operation\n" +
			"• /deletekey — Remove your stored API key\n\n" +
			"<b>What I can do:</b>\n" +
			'• Token swaps — <i>"Swap 0.1 ETH to USDC"</i>\n' +
			'• Multi-swap — <i>"Swap ETH to STRK and USDC"</i>\n' +
			'• Portfolio — <i>"Show my portfolio"</i>\n' +
			'• Portfolio rebalance — <i>"Rebalance to 50% ETH, 30% USDC, 20% STRK"</i>\n' +
			'• Staking — <i>"Stake 100 STRK on Karnot"</i>\n' +
			'• Compound rewards — <i>"Compound my staking rewards"</i>\n' +
			'• Lending — <i>"Supply 0.5 ETH on Vesu"</i>\n' +
			'• Borrow/Repay — <i>"Borrow 100 USDC and swap to STRK"</i>\n' +
			'• Lending monitor — <i>"Check my lending health"</i>\n' +
			'• Auto-rebalance — <i>"Fix my unhealthy position"</i>\n' +
			'• Batch operations — <i>"Swap + stake in one tx"</i>\n' +
			'• DCA orders — <i>"Buy 10 USDC of ETH every day"</i>\n' +
			'• Gas abstraction — <i>"Use gasless mode"</i>\n' +
			'• Confidential transfers — <i>"Fund 100 USDC to my confidential account"</i>\n' +
			'• Simulation — <i>"Simulate before executing"</i>\n\n' +
			"Just describe what you want — in any language!",
		{
			parse_mode: "HTML",
			...Markup.inlineKeyboard([
				[Markup.button.callback("About StarkFi", "action:about")],
				[Markup.button.url("Website", "https://starkfi.app")],
				[Markup.button.url("Documentation", "https://docs.starkfi.app/docs")],
			]),
		}
	);
}
