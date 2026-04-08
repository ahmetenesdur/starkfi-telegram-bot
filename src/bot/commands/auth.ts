import { join } from "node:path";
import { Markup } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { requestLogin, verifyOtp, writeSessionFile } from "../../auth/starkfi-auth.js";
import type { Config } from "../../lib/config.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import { logger } from "../../lib/logger.js";

export function createAuthCommand(_config: Config, _mcpPool: McpProcessPool) {
	return async function authCommand(ctx: BotContext): Promise<void> {
		const userId = ctx.from?.id?.toString();
		if (!userId) return;

		ctx.store.setAuthState(userId, JSON.stringify({ step: "awaiting_email" }));

		await ctx.reply(
			"<b>StarkFi Login</b>\n\n" +
				"Enter the email address associated with your StarkFi account:",
			{ parse_mode: "HTML" }
		);
	};
}

export function createEmailHandler(config: Config) {
	return async function handleEmail(ctx: BotContext, email: string): Promise<void> {
		const userId = ctx.from?.id?.toString();
		if (!userId) return;

		try {
			await requestLogin(config.starkfiServerUrl, email);

			ctx.store.setAuthState(
				userId,
				JSON.stringify({
					step: "awaiting_otp",
					email,
				})
			);

			await ctx.reply(
				`Verification code sent to <b>${email}</b>.\n\n` +
					"Enter the 6-digit code from your inbox:",
				{ parse_mode: "HTML" }
			);
		} catch (error) {
			ctx.store.clearAuthState(userId);
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Auth login failed", { userId, error: msg });
			await ctx.reply("Login failed. Please try again.\n\nUse /auth to start over.", {
				...Markup.inlineKeyboard([Markup.button.callback("Try Again", "action:auth")]),
			});
		}
	};
}

export function createOtpHandler(config: Config, mcpPool: McpProcessPool, dataDir: string) {
	return async function handleOtp(ctx: BotContext, email: string, code: string): Promise<void> {
		const userId = ctx.from?.id?.toString();
		if (!userId) return;

		try {
			const auth = await verifyOtp(config.starkfiServerUrl, email, code);

			const userHome = join(dataDir, "users", userId);
			await writeSessionFile(userHome, auth, config.starkfiServerUrl);

			ctx.store.updateStarkfiAddr(userId, auth.walletAddress);
			ctx.store.clearAuthState(userId);

			await mcpPool.removeClient(userId);

			const walletLine = `<code>${auth.walletAddress}</code>`;

			await ctx.reply(
				"<b>Logged In</b>\n\n" +
					`Address: ${walletLine}\n` +
					"Network: mainnet\n\n" +
					"You're all set! Try <i>\"What's my balance?\"</i>",
				{ parse_mode: "HTML" }
			);
		} catch (error) {
			ctx.store.clearAuthState(userId);
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Auth verify failed", { userId, error: msg });
			await ctx.reply("Verification failed. Please try again.\n\nUse /auth to start over.", {
				...Markup.inlineKeyboard([Markup.button.callback("Try Again", "action:auth")]),
			});
		}
	};
}
