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
		logger.error("AI request failed", { provider, modelName, error: errorMsg });

		const label = PROVIDER_LABELS[provider] ?? provider;

		if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
			throw new Error("API key is invalid or expired. Use /setup to configure a new key.", {
				cause: error,
			});
		}
		if (errorMsg.includes("429") || errorMsg.includes("rate")) {
			throw new Error(
				`${label} rate limit exceeded — your API key has hit its usage limit. ` +
					"Please wait a minute and try again, or upgrade your plan.",
				{ cause: error }
			);
		}
		if (errorMsg.includes("insufficient_quota")) {
			throw new Error(
				`Your ${label} API quota is exhausted. Check your billing at your provider dashboard.`,
				{ cause: error }
			);
		}

		throw new Error(
			`An unexpected error occurred while processing your request. Please try again.`,
			{ cause: error }
		);
	}
}
