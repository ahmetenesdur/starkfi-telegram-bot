import type { BotContext } from "../middleware/session.js";
import { PROVIDER_LABELS } from "../../session/types.js";
import { truncateAddress } from "../../lib/format.js";
import type { McpProcessPool } from "../../mcp/pool.js";

export function createStatusCommand(mcpPool: McpProcessPool) {
	return async function statusCommand(ctx: BotContext): Promise<void> {
		const session = ctx.userSession;

		if (!session) {
			await ctx.reply(
				"*Status*\n\n" +
					"• AI Model: Not configured\n" +
					"• Wallet: Not connected\n\n" +
					"Use /setup to get started.",
				{ parse_mode: "Markdown" }
			);
			return;
		}

		const walletLine = session.starkfiAddr
			? `\`${truncateAddress(session.starkfiAddr)}\``
			: "Not connected (/auth)";

		await ctx.reply(
			"*Status*\n\n" +
				`• AI Provider: *${PROVIDER_LABELS[session.provider]}*\n` +
				`• Model: \`${session.modelName}\`\n` +
				`• Wallet: ${walletLine}\n` +
				`• History: ${session.history.length} messages\n` +
				`• Active MCP: ${mcpPool.activeCount} processes`,
			{ parse_mode: "Markdown" }
		);
	};
}
