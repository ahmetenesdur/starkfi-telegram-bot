import type { BotContext } from "../middleware/session.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import type { MessageQueue } from "../middleware/queue.js";
import type { Config } from "../../lib/config.js";
import { processMessage } from "../../ai/router.js";
import { chunkMessage, sanitizeForTelegram } from "../../lib/format.js";
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

			// Repeat "typing..." indicator during long AI/MCP calls
			const typingInterval = setInterval(() => {
				ctx.sendChatAction("typing").catch(() => {
					/* ignore — best-effort */
				});
			}, 4_000);

			try {
				const apiKey = ctx.store.decryptApiKey(session, ctx.encryptionSecret);
				const { tools } = await mcpPool.getClient(userId);

				const result = await processMessage({
					provider: session.provider,
					apiKey,
					modelName: session.modelName,
					history: session.history,
					userMessage: text,
					tools,
				});

				ctx.store.updateHistory(userId, result.history, config.maxHistory);

				const sanitized = sanitizeForTelegram(result.text);
				const chunks = chunkMessage(sanitized);
				for (const chunk of chunks) {
					// Try Markdown first, fall back to plain text
					try {
						await ctx.reply(chunk, { parse_mode: "Markdown" });
					} catch {
						await ctx.reply(chunk);
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error("Message processing failed", { userId, error: errorMsg });

				// All errors from router.ts are already user-friendly
				await ctx.reply(errorMsg);
			} finally {
				clearInterval(typingInterval);
			}
		});
	};
}
