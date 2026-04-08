import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import type { MessageQueue } from "../middleware/queue.js";
import type { Config } from "../../lib/config.js";
import { processMessage } from "../../ai/router.js";
import { StarkFiStreamManager } from "../utils/stream.js";
import { getAbortController, clearAbortController } from "../commands/cancel.js";
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

			// Create an AbortController for this stream (cancels any previous one)
			const abortController = getAbortController(userId);

			try {
				const apiKey = ctx.store.decryptApiKey(session, ctx.encryptionSecret);
				const { tools } = await mcpPool.getClient(userId);

				// Initialize stream manager with abort signal
				const streamManager = new StarkFiStreamManager(ctx, abortController.signal);
				await streamManager.initialize();

				const streamResult = await processMessage({
					provider: session.provider,
					apiKey,
					modelName: session.modelName,
					history: session.history,
					userMessage: text,
					tools,
					abortSignal: abortController.signal,
					onStatusUpdate: (label) => streamManager.updateStatus(label),
				});

				// Keep typing indicator alive during stream
				const typingInterval = setInterval(() => {
					streamManager.refreshTypingStatus();
				}, 4000);

				try {
					for await (const chunk of streamResult.textStream) {
						if (abortController.signal.aborted) break;
						await streamManager.appendChunk(chunk);
					}
				} finally {
					clearInterval(typingInterval);
					await streamManager.finalize();
				}

				// Grab the final processed history (if not aborted)
				if (!abortController.signal.aborted) {
					const history = await streamResult.getFinalHistory();
					ctx.store.updateHistory(userId, history, config.maxHistory);
				}
			} catch (error) {
				// Ignore abort errors
				if (abortController.signal.aborted) return;

				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error("Message processing failed", { userId, error: errorMsg });

				// Contextual error response with inline keyboard
				const buttons = getErrorButtons(errorMsg);
				await ctx.reply(`<b>[Error]:</b> ${escapeHtml(errorMsg)}`, {
					parse_mode: "HTML",
					...(buttons.length > 0 ? Markup.inlineKeyboard(buttons.map((b) => [b])) : {}),
				});
			} finally {
				clearAbortController(userId);
			}
		});
	};
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getErrorButtons(errorMsg: string) {
	const lower = errorMsg.toLowerCase();

	if (lower.includes("api key") || lower.includes("/setup")) {
		return [Markup.button.callback("Setup AI Model", "action:setup")];
	}

	if (
		lower.includes("/model") ||
		lower.includes("model not") ||
		lower.includes("not available")
	) {
		return [Markup.button.callback("Switch Model", "action:setup")];
	}

	if (lower.includes("quota") || lower.includes("billing")) {
		return [Markup.button.callback("Change Provider", "action:setup")];
	}

	if (lower.includes("session expired") || lower.includes("/auth")) {
		return [Markup.button.callback("Log In", "action:auth")];
	}

	return [];
}
