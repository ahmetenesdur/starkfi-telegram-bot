import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createModel } from "./providers.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { PROVIDER_LABELS, type Provider } from "../session/types.js";
import type { McpToolSet } from "../mcp/pool.js";
import { logger } from "../lib/logger.js";

// Human-readable labels for tool calls shown during streaming
const TOOL_LABELS: Record<string, string> = {
	get_swap_quote: "Fetching swap quote",
	swap_tokens: "Executing swap",
	get_multi_swap_quote: "Fetching multi-swap quote",
	multi_swap: "Executing multi-swap",
	get_portfolio: "Loading portfolio",
	list_validators: "Checking validators",
	list_pools: "Checking staking pools",
	stake_tokens: "Staking tokens",
	unstake_tokens: "Unstaking tokens",
	claim_rewards: "Claiming rewards",
	compound_rewards: "Compounding rewards",
	list_lending_pools: "Checking lending pools",
	supply_lending: "Supplying to lending pool",
	borrow_lending: "Borrowing from lending pool",
	repay_lending: "Repaying lending debt",
	withdraw_lending: "Withdrawing from lending pool",
	close_lending_position: "Closing lending position",
	monitor_lending_position: "Checking position health",
	auto_rebalance_lending: "Rebalancing lending position",
	dca_preview: "Previewing DCA order",
	dca_create: "Creating DCA order",
	dca_list: "Loading DCA orders",
	dca_cancel: "Cancelling DCA order",
	rebalance_portfolio: "Rebalancing portfolio",
	confidential_balance: "Checking confidential balance",
	confidential_fund: "Funding confidential account",
	confidential_transfer: "Sending confidential transfer",
	confidential_withdraw: "Withdrawing from confidential",
	deploy_account: "Deploying account",
};

export interface RouterInput {
	provider: Provider;
	apiKey: string;
	modelName: string;
	history: ModelMessage[];
	userMessage: string;
	tools: McpToolSet;
	abortSignal?: AbortSignal;
	onStatusUpdate?: (label: string) => void;
}

export interface RouterResult {
	textStream: AsyncIterable<string>;
	getFinalHistory: () => Promise<ModelMessage[]>;
}

const MAX_TOOL_RESULT_LENGTH = 2000;

export async function processMessage(input: RouterInput): Promise<RouterResult> {
	const {
		provider,
		apiKey,
		modelName,
		history,
		userMessage,
		tools,
		abortSignal,
		onStatusUpdate,
	} = input;

	const model = createModel(provider, apiKey, modelName);

	const messages: ModelMessage[] = [...history, { role: "user", content: userMessage }];

	logger.debug("AI request", {
		provider,
		modelName,
		messageCount: messages.length,
		toolCount: Object.keys(tools).length,
	});

	try {
		const result = streamText({
			model,
			tools,
			system: SYSTEM_PROMPT,
			messages,
			abortSignal,
			stopWhen: stepCountIs(10),

			onStepFinish({ stepNumber, finishReason, usage }) {
				logger.debug("AI step stream completed", {
					stepNumber,
					reason: finishReason,
					tokens: usage.totalTokens,
				});
			},

			experimental_onToolCallStart({ toolCall }) {
				const label = TOOL_LABELS[toolCall.toolName] ?? toolCall.toolName;
				logger.debug("Tool call started", { toolName: toolCall.toolName });
				onStatusUpdate?.(label);
			},

			experimental_onToolCallFinish({ toolCall, durationMs }) {
				logger.debug("Tool call stream completed", {
					toolName: toolCall.toolName,
					durationMs,
				});
			},
		});

		return {
			textStream: result.textStream,
			getFinalHistory: async () => {
				const responseText =
					(await result.text) ||
					"I completed the operation but have no additional output.";

				// Truncate large string content in history to save tokens
				const trimmedMessages: ModelMessage[] = messages.map((msg) => {
					if (
						typeof msg.content === "string" &&
						msg.content.length > MAX_TOOL_RESULT_LENGTH
					) {
						return {
							...msg,
							content: msg.content.slice(0, MAX_TOOL_RESULT_LENGTH) + "\n[truncated]",
						} as ModelMessage;
					}
					return msg;
				});

				return [...trimmedMessages, { role: "assistant" as const, content: responseText }];
			},
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const lowerMsg = errorMsg.toLowerCase();

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

		if (
			statusCode === 401 ||
			statusCode === 403 ||
			lowerMsg.includes("unauthorized") ||
			lowerMsg.includes("invalid api key") ||
			lowerMsg.includes("invalid x-api-key") ||
			lowerMsg.includes("api-key") ||
			lowerMsg.includes("authentication_error") ||
			lowerMsg.includes("permission denied") ||
			lowerMsg.includes("api key not valid")
		) {
			throw new Error("API key is invalid or expired. Use /setup to configure a new key.", {
				cause: error,
			});
		}

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

		if (statusCode && statusCode >= 500) {
			throw new Error(
				`${label} is experiencing server issues (${statusCode}). Please try again later.`,
				{ cause: error }
			);
		}

		// Empty model output — typically caused by an invalid/expired API key
		// or the provider silently rejecting the request without a proper error code.
		if (
			lowerMsg.includes("model output") ||
			lowerMsg.includes("empty response") ||
			lowerMsg.includes("both be empty")
		) {
			throw new Error(
				"The AI model returned an empty response. This usually means your API key is invalid or expired. Use /setup to configure a new key.",
				{ cause: error }
			);
		}

		throw new Error(
			`${label} request failed. Please try again. If the problem persists, try /model to switch models.`,
			{ cause: error }
		);
	}
}
