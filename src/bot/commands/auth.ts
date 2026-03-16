import { join } from "node:path";
import type { BotContext } from "../middleware/session.js";
import { requestLogin, verifyOtp, writeSessionFile } from "../../auth/starkfi-auth.js";
import type { Config } from "../../lib/config.js";
import type { McpProcessPool } from "../../mcp/pool.js";
import { logger } from "../../lib/logger.js";

export function createAuthCommand(_config: Config, _mcpPool: McpProcessPool) {
	return async function authCommand(ctx: BotContext): Promise<void> {
		const userId = ctx.from!.id.toString();

		ctx.store.setAuthState(userId, JSON.stringify({ step: "awaiting_email" }));

		await ctx.reply(
			"*StarkFi Login*\n\n" + "Enter your email address to log in to your StarkFi account:",
			{ parse_mode: "Markdown" }
		);
	};
}

export function createEmailHandler(config: Config) {
	return async function handleEmail(ctx: BotContext, email: string): Promise<void> {
		const userId = ctx.from!.id.toString();

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
				`Verification code sent to *${email}*\n\n` + "Enter the 6-digit code you received:",
				{ parse_mode: "Markdown" }
			);
		} catch (error) {
			ctx.store.clearAuthState(userId);
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Auth login failed", { userId, error: msg });
			await ctx.reply(`Login failed: ${msg}\n\nTry /auth again.`);
		}
	};
}

export function createOtpHandler(config: Config, mcpPool: McpProcessPool, dataDir: string) {
	return async function handleOtp(ctx: BotContext, email: string, code: string): Promise<void> {
		const userId = ctx.from!.id.toString();

		try {
			const auth = await verifyOtp(config.starkfiServerUrl, email, code);

			const userHome = join(dataDir, "users", userId);
			await writeSessionFile(userHome, auth, config.starkfiServerUrl);

			ctx.store.updateStarkfiAddr(userId, auth.walletAddress);
			ctx.store.clearAuthState(userId);

			// Kill existing MCP so it restarts with new session credentials
			await mcpPool.removeClient(userId);

			await ctx.reply(
				"*Logged In* ✓\n\n" +
					`• Address: \`${auth.walletAddress}\`\n` +
					"• Network: mainnet\n\n" +
					"You're all set! Try: _\"What's my balance?\"_",
				{ parse_mode: "Markdown" }
			);
		} catch (error) {
			ctx.store.clearAuthState(userId);
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("Auth verify failed", { userId, error: msg });
			await ctx.reply(`Verification failed: ${msg}\n\nTry /auth again.`);
		}
	};
}
