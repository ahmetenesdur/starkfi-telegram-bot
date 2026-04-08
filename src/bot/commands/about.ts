import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";

export async function aboutCommand(ctx: BotContext): Promise<void> {
	await ctx.reply(
		"<b>About StarkFi</b>\n\n" +
			"StarkFi is the AI-native DeFi toolkit for <b>Starknet</b>, " +
			"powered by the Starkzap SDK.\n\n" +
			"<b>What it includes:</b>\n" +
			"• CLI with 42+ commands across 12 groups\n" +
			"• MCP server with 42 tools for AI agents\n" +
			"• 12 agent skills for autonomous DeFi workflows\n\n" +
			"<b>Key capabilities:</b>\n" +
			"• DEX-aggregated swaps via Fibrous\n" +
			"• Multi-token swaps in a single transaction\n" +
			"• Multi-token staking across validators\n" +
			"• Compound staking rewards in one tx\n" +
			"• Lending and borrowing on Vesu V2\n" +
			"• Lending health monitor with 4-level risk alerts\n" +
			"• Auto-rebalance unhealthy lending positions\n" +
			"• Portfolio dashboard with USD valuations\n" +
			"• Portfolio rebalancing to target allocations\n" +
			"• Dollar-Cost Averaging (DCA) with recurring orders\n" +
			"• Confidential (private) transfers with ZK proofs via Tongo Cash\n" +
			"• Gasless and gasfree transactions via AVNU Paymaster\n" +
			"• Transaction simulation and fee preview\n" +
			"• Atomic multicall batching\n\n" +
			"This bot is a live example of what you can build with " +
			"StarkFi's MCP server.",
		{
			parse_mode: "HTML",
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
