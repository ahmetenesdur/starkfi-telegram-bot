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

				// Unwrap the error cause chain to find the real API error.
				// Vercel AI SDK wraps API errors (e.g., 401 invalid key) inside
				// generic messages like "No output generated".
				const rootError = extractRootError(error);
				const errorMsg = rootError.message;
				const statusCode = rootError.statusCode;

				logger.error("Message processing failed", {
					userId,
					error: errorMsg,
					statusCode,
				});

				// Build user-friendly error message based on the real cause
				const displayMsg = getHumanErrorMessage(errorMsg, statusCode);
				const buttons = getErrorButtons(displayMsg);

				await ctx.reply(`⚠️ <b>Error</b>\n\n• <b>Reason:</b> ${escapeHtml(displayMsg)}`, {
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

/**
 * Walks the error `.cause` chain to find the deepest error with a
 * `statusCode` (from Vercel AI SDK's APICallError) or meaningful message.
 */
function extractRootError(error: unknown): {
	message: string;
	statusCode: number | undefined;
} {
	let current = error;
	let bestMessage = error instanceof Error ? error.message : String(error);
	let bestStatusCode: number | undefined;

	// Walk up to 5 levels deep in the cause chain
	for (let depth = 0; depth < 5; depth++) {
		if (!(current instanceof Error)) break;

		// Prefer errors with a statusCode (APICallError)
		if ("statusCode" in current && typeof current.statusCode === "number") {
			bestStatusCode = current.statusCode as number;
			bestMessage = current.message;
		}

		if (!current.cause) break;
		current = current.cause;
	}

	return { message: bestMessage, statusCode: bestStatusCode };
}

/**
 * Translates raw error messages and status codes into user-friendly text.
 */
function getHumanErrorMessage(errorMsg: string, statusCode?: number): string {
	const lower = errorMsg.toLowerCase();

	// Auth errors
	if (
		statusCode === 401 ||
		statusCode === 403 ||
		lower.includes("api-key") ||
		lower.includes("api key") ||
		lower.includes("unauthorized") ||
		lower.includes("authentication")
	) {
		return "Your API key is invalid or expired. Use /setup to configure a new key.";
	}

	// Rate limits
	if (statusCode === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
		return "Rate limit exceeded — please wait a moment and try again.";
	}

	// Quota
	if (lower.includes("quota") || lower.includes("billing") || lower.includes("payment")) {
		return "Your API quota is exhausted. Check your billing at your provider dashboard.";
	}

	// Empty output (SDK wrapper for various failures)
	if (lower.includes("no output") || lower.includes("both be empty") || lower.includes("empty")) {
		return "The AI model returned an empty response. This usually means your API key is invalid or expired. Use /setup to configure a new key.";
	}

	// Model not found
	if (statusCode === 404 || lower.includes("model not found") || lower.includes("not_found")) {
		return "The selected model is not available. Use /model to switch to a different model.";
	}

	// Network
	if (
		lower.includes("timeout") ||
		lower.includes("econnrefused") ||
		lower.includes("fetch failed")
	) {
		return "Could not reach the AI provider — the service may be temporarily unavailable. Please try again.";
	}

	// Server errors
	if (statusCode && statusCode >= 500) {
		return `The AI provider is experiencing server issues (${statusCode}). Please try again later.`;
	}

	return errorMsg;
}

function getErrorButtons(errorMsg: string) {
	const lower = errorMsg.toLowerCase();

	if (
		lower.includes("api key") ||
		lower.includes("/setup") ||
		lower.includes("empty response") ||
		lower.includes("invalid or expired")
	) {
		return [Markup.button.callback("🔑 Setup AI Model", "action:setup")];
	}

	if (
		lower.includes("/model") ||
		lower.includes("model not") ||
		lower.includes("not available")
	) {
		return [Markup.button.callback("🔄 Switch Model", "action:setup")];
	}

	if (lower.includes("quota") || lower.includes("billing")) {
		return [Markup.button.callback("💳 Change Provider", "action:setup")];
	}

	if (lower.includes("session expired") || lower.includes("/auth")) {
		return [Markup.button.callback("🔐 Log In", "action:auth")];
	}

	return [];
}
