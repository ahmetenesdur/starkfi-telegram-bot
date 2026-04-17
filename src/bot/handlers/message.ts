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

			// Hoisted so the catch block can overwrite the "Processing..." message
			let streamMessageId: number | null = null;

			try {
				const apiKey = ctx.store.decryptApiKey(session, ctx.encryptionSecret);
				const { tools } = await mcpPool.getClient(userId);

				// Initialize stream manager with abort signal
				const streamManager = new StarkFiStreamManager(ctx, abortController.signal);
				await streamManager.initialize();
				streamMessageId = streamManager.getMessageId();

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

				const rawMsg = error instanceof Error ? error.message : String(error);
				const { message: displayMsg, button } = classifyError(error);
				logger.error("Message processing failed", {
					userId,
					error: rawMsg,
					displayedAs: displayMsg,
				});

				const errorHtml = `⚠️ <b>Error</b>\n\n• <b>Reason:</b> ${escapeHtml(displayMsg)}`;
				const replyMarkup = button
					? Markup.inlineKeyboard([[Markup.button.callback(button.text, button.action)]])
					: undefined;

				// Overwrite the "Processing..." message if it exists
				if (streamMessageId) {
					try {
						await ctx.telegram.editMessageText(
							ctx.chat?.id,
							streamMessageId,
							undefined,
							errorHtml,
							{
								parse_mode: "HTML",
								...(replyMarkup ?? {}),
							}
						);
					} catch {
						// Edit failed (message deleted, etc.) — fall back to a new reply
						await ctx.reply(errorHtml, {
							parse_mode: "HTML",
							...(replyMarkup ?? {}),
						});
					}
				} else {
					await ctx.reply(errorHtml, {
						parse_mode: "HTML",
						...(replyMarkup ?? {}),
					});
				}
			} finally {
				clearAbortController(userId);
			}
		});
	};
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Error Classification ────────────────────────────────────────────

interface ClassifiedError {
	message: string;
	button?: { text: string; action: string };
}

/**
 * Single source of truth for error handling.
 * Unwraps the Vercel AI SDK error cause chain, extracts the real API error,
 * and returns a user-friendly message with an optional action button.
 */
function classifyError(error: unknown): ClassifiedError {
	// 1. Walk the .cause chain to find the deepest error with a statusCode
	let current = error;
	let message = error instanceof Error ? error.message : String(error);
	let statusCode: number | undefined;

	for (let depth = 0; depth < 5; depth++) {
		if (!(current instanceof Error)) break;
		if ("statusCode" in current && typeof current.statusCode === "number") {
			statusCode = current.statusCode as number;
			message = current.message;
		}
		if (!current.cause) break;
		current = current.cause;
	}

	const lower = message.toLowerCase();

	// 2. Classify by category

	// Auth / API Key
	if (
		statusCode === 401 ||
		statusCode === 403 ||
		lower.includes("api-key") ||
		lower.includes("api key") ||
		lower.includes("unauthorized") ||
		lower.includes("authentication") ||
		lower.includes("permission denied")
	) {
		return {
			message: "Your API key is invalid or expired. Use /setup to configure a new key.",
			button: { text: "🔑 Setup AI Model", action: "action:setup" },
		};
	}

	// Rate Limit
	if (
		statusCode === 429 ||
		lower.includes("rate limit") ||
		lower.includes("rate_limit") ||
		lower.includes("too many requests") ||
		lower.includes("resource_exhausted")
	) {
		return {
			message: "Rate limit exceeded — please wait a moment and try again.",
		};
	}

	// Quota / Billing
	if (
		lower.includes("quota") ||
		lower.includes("billing") ||
		lower.includes("payment") ||
		lower.includes("exceeded your current") ||
		lower.includes("insufficient_quota")
	) {
		return {
			message: "Your API quota is exhausted. Check your billing at your provider dashboard.",
			button: { text: "💳 Change Provider", action: "action:setup" },
		};
	}

	// Content Filter / Safety
	if (
		lower.includes("content filter") ||
		lower.includes("safety") ||
		lower.includes("blocked") ||
		lower.includes("harm_category")
	) {
		return {
			message:
				"Your message was blocked by the AI provider's content policy. Please rephrase and try again.",
		};
	}

	// Model Not Found
	if (
		statusCode === 404 ||
		lower.includes("model not found") ||
		lower.includes("does not exist") ||
		lower.includes("not_found")
	) {
		return {
			message:
				"The selected model is not available. Use /model to switch to a different model.",
			button: { text: "🔄 Switch Model", action: "action:setup" },
		};
	}

	// Empty Output (Vercel AI SDK wrapper — usually a masked auth error)
	if (
		lower.includes("no output") ||
		lower.includes("both be empty") ||
		lower.includes("model output") ||
		lower.includes("empty response")
	) {
		return {
			message:
				"The AI model returned an empty response — your API key may be invalid. Use /setup to configure a new key.",
			button: { text: "🔑 Setup AI Model", action: "action:setup" },
		};
	}

	// Network / Timeout
	if (
		lower.includes("timeout") ||
		lower.includes("timed out") ||
		lower.includes("econnrefused") ||
		lower.includes("enotfound") ||
		lower.includes("fetch failed") ||
		lower.includes("network")
	) {
		return {
			message:
				"Could not reach the AI provider — the service may be temporarily unavailable. Please try again.",
		};
	}

	// Server Error (5xx)
	if (statusCode && statusCode >= 500) {
		return {
			message: `The AI provider is experiencing server issues (${statusCode}). Please try again later.`,
		};
	}

	// Session Expired
	if (lower.includes("session expired") || lower.includes("/auth")) {
		return {
			message: "Your session has expired. Please log in again.",
			button: { text: "🔐 Log In", action: "action:auth" },
		};
	}

	// Fallback
	return {
		message:
			"Request failed. Please try again. If the problem persists, try /model to switch models.",
	};
}
