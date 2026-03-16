import { generateText, stepCountIs, type ModelMessage } from "ai";
import type { MCPClient } from "@ai-sdk/mcp";
import { createModel } from "./providers.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import type { Provider } from "../session/types.js";
import { logger } from "../lib/logger.js";

export interface RouterInput {
	provider: Provider;
	apiKey: string;
	modelName: string;
	history: ModelMessage[];
	userMessage: string;
	mcpClient: MCPClient;
}

export interface RouterResult {
	text: string;
	history: ModelMessage[];
}

export async function processMessage(input: RouterInput): Promise<RouterResult> {
	const { provider, apiKey, modelName, history, userMessage, mcpClient } = input;

	const model = createModel(provider, apiKey, modelName);
	const tools = await mcpClient.tools();

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
		});

		// Surface tool errors that would otherwise fail silently
		const toolErrors = result.steps.flatMap((step) =>
			step.content.filter(
				(part): part is Extract<typeof part, { type: "tool-error" }> =>
					part.type === "tool-error"
			)
		);

		for (const err of toolErrors) {
			logger.warn("Tool execution error", {
				toolName: err.toolName,
				error: String(err.error),
			});
		}

		const responseText =
			result.text || "I completed the operation but have no additional output.";

		const updatedHistory: ModelMessage[] = [
			...messages,
			{ role: "assistant", content: responseText },
		];

		logger.debug("AI response", {
			provider,
			steps: result.steps.length,
			toolErrors: toolErrors.length,
			responseLength: responseText.length,
		});

		return { text: responseText, history: updatedHistory };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error("AI request failed", { provider, modelName, error: errorMsg });

		if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
			throw new Error("API key is invalid or expired. Use /setup to configure a new key.", {
				cause: error,
			});
		}
		if (errorMsg.includes("429") || errorMsg.includes("rate")) {
			throw new Error("Rate limit exceeded. Please wait a moment and try again.", {
				cause: error,
			});
		}
		if (errorMsg.includes("insufficient_quota")) {
			throw new Error(
				"Your API quota is exhausted. Check your billing at your AI provider.",
				{ cause: error }
			);
		}

		throw new Error(`AI error: ${errorMsg}`, { cause: error });
	}
}
