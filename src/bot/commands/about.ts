import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function aboutCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"*About StarkFi*\n\n" +
			"StarkFi is the AI-native DeFi toolkit for *Starknet*, " +
			"powered by the Starkzap SDK.\n\n" +
			"*What it includes:*\n" +
			"• CLI with 30+ commands across 10 groups\n" +
			"• MCP server with 30 tools for AI agents\n" +
			"• 10 agent skills for autonomous DeFi workflows\n\n" +
			"*Key capabilities:*\n" +
			"• DEX-aggregated swaps via Fibrous\n" +
			"• Multi-token swaps in a single transaction\n" +
			"• Multi-token staking across validators\n" +
			"• Compound staking rewards in one tx\n" +
			"• Lending and borrowing on Vesu V2\n" +
			"• Lending health monitor with 4-level risk alerts\n" +
			"• Auto-rebalance unhealthy lending positions\n" +
			"• Portfolio dashboard with USD valuations\n" +
			"• Portfolio rebalancing to target allocations\n" +
			"• Gasless and gasfree transactions via AVNU Paymaster\n" +
			"• Transaction simulation and fee preview\n" +
			"• Atomic multicall batching\n\n" +
			"This bot is a live example of what you can build with " +
			"StarkFi's MCP server.",
		{
			parse_mode: "Markdown",
			...Markup.inlineKeyboard([
				[
					Markup.button.url("Website", "https://starkfi.app"),
					Markup.button.url("Docs", "https://docs.starkfi.app/docs"),
				],
				[
					Markup.button.url("GitHub", "https://github.com/ahmetenesdur/starkfi"),
					Markup.button.url("npm", "https://npmjs.com/package/starkfi"),
				],
				[Markup.button.url("Twitter/X", "https://x.com/starkfiapp")],
			]),
		}
	);
}
