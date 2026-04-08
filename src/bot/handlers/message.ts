import type { BotContext } from "../middleware/session.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import type { MessageQueue } from "../middleware/queue.js";
import type { Config } from "../../lib/config.js";
import { processMessage } from "../../ai/router.js";
import { StarkFiStreamManager } from "../utils/stream.js";
import { logger } from "../../lib/logger.js";

export function createMessageHandler(
	config: Config,
	mcpPool: McpProcessPool,
	messageQueue: MessageQueue
) {
	return async function handleMessage(ctx: BotContext): Promise<void> {
		if (!("text" in (ctx.message ?? {}))) return;

		const text = (ctx.message as { text: string }).text;
		const userId = ctx.from?.id?.toString();
		if (!userId) return;

		const session = ctx.userSession;
		if (!session) return;

		await messageQueue.enqueue(userId, async () => {
			await ctx.sendChatAction("typing");

			try {
				const apiKey = ctx.store.decryptApiKey(session, ctx.encryptionSecret);
				const { tools } = await mcpPool.getClient(userId);

				// Initialize Real-Time Stream Manager
				const streamManager = new StarkFiStreamManager(ctx);
				await streamManager.initialize();

				const streamResult = await processMessage({
					provider: session.provider,
					apiKey,
					modelName: session.modelName,
					history: session.history,
					userMessage: text,
					tools,
				});

				// Continuously update the typing indicator outside of the edit loop
				const typingInterval = setInterval(() => {
					streamManager.refreshTypingStatus();
				}, 4000);

				try {
					for await (const chunk of streamResult.textStream) {
						await streamManager.appendChunk(chunk);
					}
				} finally {
					clearInterval(typingInterval);
					await streamManager.finalize();
				}

				// The stream has successfully finished, grab the final processed history
				const history = await streamResult.getFinalHistory();
				ctx.store.updateHistory(userId, history, config.maxHistory);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error("Message processing failed", { userId, error: errorMsg });
				await ctx.reply(`<b>[Error]:</b> ${errorMsg}`, { parse_mode: "HTML" });
			}
		});
	};
}
