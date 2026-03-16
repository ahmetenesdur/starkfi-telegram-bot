import type { BotContext } from "../middleware/session.js";
import type { Config } from "../../lib/config.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import { handleProviderSelection } from "../commands/setup.js";
import { createEmailHandler, createOtpHandler } from "../commands/auth.js";
import { setupCommand } from "../commands/setup.js";
import { helpCommand } from "../commands/help.js";
import { createAuthCommand } from "../commands/auth.js";
import type { Provider } from "../../session/types.js";
import { logger } from "../../lib/logger.js";

export function createInteractionHandlers(
	config: Config,
	mcpPool: McpProcessPool,
	dataDir: string
) {
	const handleEmail = createEmailHandler(config);
	const handleOtp = createOtpHandler(config, mcpPool, dataDir);
	const authCommand = createAuthCommand(config, mcpPool);

	async function handleCallback(ctx: BotContext): Promise<void> {
		const data =
			ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

		if (!data) return;

		try {
			await ctx.answerCbQuery();

			if (data.startsWith("setup:")) {
				const provider = data.split(":")[1] as Provider;
				await handleProviderSelection(ctx, provider);
				return;
			}

			if (data === "action:setup") {
				await setupCommand(ctx);
				return;
			}
			if (data === "action:auth") {
				await authCommand(ctx);
				return;
			}
			if (data === "action:help") {
				await helpCommand(ctx);
				return;
			}

			logger.warn("Unknown callback data", { data });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Callback handler error", { data, error: msg });
			await ctx.reply(`Error: ${msg}`);
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
				await handleApiKeyInput(ctx, state.provider, text.trim());
				return true;
			}
		} catch {
			ctx.store.clearAuthState(userId);
		}

		return false;
	}

	return { handleCallback, routeAuthFlow };
}
