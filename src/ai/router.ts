import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createModel } from "./providers.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import type { Provider } from "../session/types.js";
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
	// Troves — DeFi Yield Vaults
	list_troves_strategies: "Browsing vault strategies",
	get_troves_position: "Checking vault position",
	troves_deposit: "Depositing to vault",
	troves_withdraw: "Withdrawing from vault",
	// LST — Endur Liquid Staking
	get_lst_position: "Checking LST position",
	get_lst_stats: "Fetching LST stats",
	lst_stake: "Staking via Endur",
	lst_redeem: "Redeeming LST",
	lst_exit_all: "Exiting all LST",
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
		logger.error("AI request failed", {
			provider,
			modelName,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
