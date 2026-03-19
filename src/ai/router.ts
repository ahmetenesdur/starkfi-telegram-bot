import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createModel } from "./providers.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { PROVIDER_LABELS, type Provider } from "../session/types.js";
import type { McpToolSet } from "../mcp/pool.js";
import { logger } from "../lib/logger.js";

export interface RouterInput {
	provider: Provider;
	apiKey: string;
	modelName: string;
	history: ModelMessage[];
	userMessage: string;
	tools: McpToolSet;
}

export interface RouterResult {
	text: string;
	history: ModelMessage[];
}

export async function processMessage(input: RouterInput): Promise<RouterResult> {
	const { provider, apiKey, modelName, history, userMessage, tools } = input;

	const model = createModel(provider, apiKey, modelName);

	const messages: ModelMessage[] = [...history, { role: "user", content: userMessage }];

	logger.debug("AI request", {
		provider,
		modelName,
		messageCount: messages.length,
		toolCount: Object.keys(tools).length,
	});

	try {
		const result = await generateText({
			model,
			tools,
			system: SYSTEM_PROMPT,
			messages,
			stopWhen: stepCountIs(10),

			onStepFinish({ stepNumber, finishReason, usage }) {
				logger.debug("AI step completed", {
					step: stepNumber,
					reason: finishReason,
					tokens: usage.totalTokens,
				});
			},

			experimental_onToolCallFinish({ toolCall, durationMs }) {
				logger.debug("Tool call completed", {
					toolName: toolCall.toolName,
					durationMs,
				});
			},
		});

		const responseText =
			result.text || "I completed the operation but have no additional output.";

		const updatedHistory: ModelMessage[] = [
			...messages,
			{ role: "assistant", content: responseText },
		];

		logger.debug("AI response", {
			provider,
			steps: result.steps.length,
			responseLength: responseText.length,
		});

		return { text: responseText, history: updatedHistory };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const lowerMsg = errorMsg.toLowerCase();

		// Extract HTTP status from Vercel AI SDK's APICallError
		const statusCode =
			error instanceof Error && "statusCode" in error
				? (error as { statusCode: number }).statusCode
				: undefined;

		logger.error("AI request failed", {
			provider,
			modelName,
			error: errorMsg,
			statusCode,
		});

		const label = PROVIDER_LABELS[provider] ?? provider;

		// — Authentication errors —
		if (
			statusCode === 401 ||
			statusCode === 403 ||
			lowerMsg.includes("unauthorized") ||
			lowerMsg.includes("invalid api key") ||
			lowerMsg.includes("permission denied") ||
			lowerMsg.includes("api key not valid")
		) {
			throw new Error("API key is invalid or expired. Use /setup to configure a new key.", {
				cause: error,
			});
		}

		// — Rate limit errors —
		if (
			statusCode === 429 ||
			lowerMsg.includes("rate limit") ||
			lowerMsg.includes("rate_limit") ||
			lowerMsg.includes("too many requests") ||
			lowerMsg.includes("resource_exhausted")
		) {
			throw new Error(
				`${label} rate limit exceeded — please wait a minute and try again, or upgrade your plan.`,
				{ cause: error }
			);
		}

		// — Quota / billing errors —
		if (
			lowerMsg.includes("insufficient_quota") ||
			lowerMsg.includes("quota") ||
			lowerMsg.includes("billing") ||
			lowerMsg.includes("exceeded your current") ||
			lowerMsg.includes("payment required")
		) {
			throw new Error(
				`Your ${label} API quota is exhausted. Check your billing at your provider dashboard.`,
				{ cause: error }
			);
		}

		// — Content filter / safety errors —
		if (
			lowerMsg.includes("content filter") ||
			lowerMsg.includes("safety") ||
			lowerMsg.includes("blocked") ||
			lowerMsg.includes("harm_category") ||
			lowerMsg.includes("finish_reason")
		) {
			throw new Error(
				"Your message was blocked by the AI provider's content policy. Please rephrase and try again.",
				{ cause: error }
			);
		}

		// — Model not found —
		if (
			statusCode === 404 ||
			lowerMsg.includes("model not found") ||
			lowerMsg.includes("does not exist") ||
			lowerMsg.includes("not_found")
		) {
			throw new Error(
				`The model "${modelName}" is not available. Use /model to switch to a different model.`,
				{ cause: error }
			);
		}

		// — Timeout / network errors —
		if (
			lowerMsg.includes("timeout") ||
			lowerMsg.includes("timed out") ||
			lowerMsg.includes("econnrefused") ||
			lowerMsg.includes("enotfound") ||
			lowerMsg.includes("fetch failed") ||
			lowerMsg.includes("network")
		) {
			throw new Error(
				`Could not reach ${label} — the service may be temporarily unavailable. Please try again.`,
				{ cause: error }
			);
		}

		// — Server errors —
		if (statusCode && statusCode >= 500) {
			throw new Error(
				`${label} is experiencing server issues (${statusCode}). Please try again later.`,
				{ cause: error }
			);
		}

		// — Fallback — still descriptive
		throw new Error(
			`${label} request failed. Please try again. If the problem persists, try /model to switch models.`,
			{ cause: error }
		);
	}
}
