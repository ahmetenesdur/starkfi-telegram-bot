import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import type { Config } from "../../lib/config.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import { handleProviderSelection, handleModelSelection, setupCommand } from "../commands/setup.js";
import { createEmailHandler, createOtpHandler, createAuthCommand } from "../commands/auth.js";
import { helpCommand } from "../commands/help.js";
import { MODEL_OPTIONS, type Provider } from "../../session/types.js";
import { logger } from "../../lib/logger.js";

export function createInteractionHandlers(
	config: Config,
	mcpPool: McpProcessPool,
	dataDir: string
) {
	const handleEmail = createEmailHandler(config);
	const handleOtp = createOtpHandler(config, mcpPool, dataDir);
	const authCommand = createAuthCommand(config, mcpPool);

	async function handleSetupCallback(ctx: BotContext, data: string): Promise<void> {
		const provider = data.split(":")[1] as Provider;
		await handleProviderSelection(ctx, provider);
	}

	async function handleSetupModelCallback(ctx: BotContext, data: string): Promise<void> {
		const parts = data.split(":");
		const provider = parts[1] as Provider;
		const modelId = parts[2];
		await handleModelSelection(ctx, provider, modelId);
	}

	async function handleSwitchModelCallback(ctx: BotContext, data: string): Promise<void> {
		const modelId = data.split(":")[1];
		const userId = ctx.from!.id.toString();
		const session = ctx.userSession;

		if (!session) {
			await ctx.reply("No AI model configured yet. Use /setup to get started.");
			return;
		}

		const models = MODEL_OPTIONS[session.provider];
		const model = models.find((m) => m.id === modelId);

		if (!model) {
			await ctx.reply("That model is no longer available. Use /model to see your options.");
			return;
		}

		ctx.store.updateModelName(userId, modelId);

		await ctx.editMessageText(`*Model Updated*\n\n` + `Now using: \`${model.label}\``, {
			parse_mode: "Markdown",
		});
	}

	async function handleActionCallback(ctx: BotContext, data: string): Promise<boolean> {
		if (data === "action:setup") {
			await setupCommand(ctx);
			return true;
		}
		if (data === "action:auth") {
			await authCommand(ctx);
			return true;
		}
		if (data === "action:help") {
			await helpCommand(ctx);
			return true;
		}
		if (data === "action:about") {
			await ctx.reply(
				"*About StarkFi*\n\n" +
					"StarkFi is the AI-native DeFi toolkit for *Starknet*, " +
					"powered by the Starkzap SDK.\n\n" +
					"*What it includes:*\n" +
					"• CLI with 30+ commands across 10 groups\n" +
					"• MCP server with 27 tools for AI agents\n" +
					"• 10 agent skills for autonomous DeFi workflows\n\n" +
					"*Key capabilities:*\n" +
					"• DEX-aggregated swaps via Fibrous\n" +
					"• Multi-token swaps in a single transaction\n" +
					"• Multi-token staking across validators\n" +
					"• Lending and borrowing on Vesu V2\n" +
					"• Gasless and gasfree transactions via AVNU Paymaster\n" +
					"• Atomic multicall batching\n\n" +
					"This bot is a live example of what you can build with " +
					"StarkFi's MCP server.",
				{
					parse_mode: "Markdown",
					...Markup.inlineKeyboard([
						[
							Markup.button.url("Website", "https://starkfi.app"),
							Markup.button.url("Docs", "https://docs.starkfi.app/docs"),
						],
						[
							Markup.button.url("GitHub", "https://github.com/ahmetenesdur/starkfi"),
							Markup.button.url("npm", "https://npmjs.com/package/starkfi"),
						],
						[Markup.button.url("Twitter/X", "https://x.com/starkfiapp")],
					]),
				}
			);
			return true;
		}
		return false;
	}

	async function handleCallback(ctx: BotContext): Promise<void> {
		const data =
			ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

		if (!data) return;

		try {
			await ctx.answerCbQuery();

			if (data.startsWith("setup:")) {
				await handleSetupCallback(ctx, data);
				return;
			}

			if (data.startsWith("setupmodel:")) {
				await handleSetupModelCallback(ctx, data);
				return;
			}

			if (data.startsWith("switchmodel:")) {
				await handleSwitchModelCallback(ctx, data);
				return;
			}

			if (data.startsWith("action:")) {
				const handled = await handleActionCallback(ctx, data);
				if (handled) return;
			}

			logger.warn("Unknown callback data", { data });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Callback handler error", { data, error: msg });
			await ctx.reply("Something went wrong. Please try again.");
		}
	}

	async function routeAuthFlow(ctx: BotContext): Promise<boolean> {
		const userId = ctx.from?.id?.toString();
		if (!userId) return false;

		const stateRaw = ctx.store.getAuthState(userId);
		if (!stateRaw) return false;

		const text = "text" in (ctx.message ?? {}) ? (ctx.message as { text: string }).text : "";
		if (!text) return false;

		try {
			const state = JSON.parse(stateRaw) as {
				step: string;
				provider?: Provider;
				modelId?: string;
				email?: string;
			};

			if (state.step === "awaiting_email") {
				if (!text.includes("@") || !text.includes(".")) {
					await ctx.reply("Please enter a valid email address.");
					return true;
				}
				await handleEmail(ctx, text.trim());
				return true;
			}

			if (state.step === "awaiting_otp" && state.email) {
				const code = text.trim();
				if (!/^\d{4,8}$/.test(code)) {
					await ctx.reply("Please enter a valid numeric verification code.");
					return true;
				}
				await handleOtp(ctx, state.email, code);
				return true;
			}

			if (state.step === "awaiting_api_key" && state.provider) {
				const { handleApiKeyInput } = await import("../commands/setup.js");
				await handleApiKeyInput(ctx, state.provider, text.trim(), state.modelId);
				return true;
			}
		} catch (error) {
			logger.warn("Corrupt auth state cleared", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			ctx.store.clearAuthState(userId);
		}

		return false;
	}

	return { handleCallback, routeAuthFlow };
}
