import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { MODEL_OPTIONS, PROVIDER_LABELS } from "../../session/types.js";
import type { McpProcessPool } from "../../mcp/pool.js";

export function createStatusCommand(mcpPool: McpProcessPool) {
	return async function statusCommand(ctx: BotContext): Promise<void> {
		const session = ctx.userSession;

		if (!session) {
			await ctx.reply(
				"<b>Status</b>\n\n" +
					"AI Model: Not configured\n" +
					"Wallet: Not connected\n\n" +
					"Use /setup to get started.",
				{
					parse_mode: "HTML",
					...Markup.inlineKeyboard([
						Markup.button.callback("Setup AI Model", "action:setup"),
					]),
				}
			);
			return;
		}

		const walletLine = session.starkfiAddr
			? `<code>${session.starkfiAddr}</code>`
			: "Not connected (/auth)";

		const models = MODEL_OPTIONS[session.provider];
		const modelLabel =
			models.find((m) => m.id === session.modelName)?.label ?? session.modelName;

		await ctx.reply(
			"<b>Status</b>\n\n" +
				`Provider: <b>${PROVIDER_LABELS[session.provider]}</b>\n` +
				`Model: <code>${modelLabel}</code>\n` +
				`Wallet: ${walletLine}\n` +
				`History: ${session.history.length} messages\n` +
				`Active MCP: ${mcpPool.activeCount} processes`,
			{
				parse_mode: "HTML",
				...Markup.inlineKeyboard([
					[
						Markup.button.callback("Log In", "action:auth"),
						Markup.button.callback("Switch Model", "action:setup"),
					],
				]),
			}
		);
	};
}
