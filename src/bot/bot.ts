import { Telegraf, Markup } from "telegraf";
import type { Config } from "../lib/config.js";
import type { SessionStore } from "../session/store.js";
import type { McpProcessPool } from "../mcp/pool.js";
import { sessionMiddleware, type BotContext } from "./middleware/session.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { MessageQueue } from "./middleware/queue.js";
import { startCommand } from "./commands/start.js";
import { setupCommand } from "./commands/setup.js";
import { createAuthCommand } from "./commands/auth.js";
import { modelCommand } from "./commands/model.js";
import { createStatusCommand } from "./commands/status.js";
import { helpCommand } from "./commands/help.js";
import { clearCommand } from "./commands/clear.js";
import { createDeleteKeyCommand } from "./commands/deletekey.js";
import { createMessageHandler } from "./handlers/message.js";
import { createInteractionHandlers } from "./handlers/callback.js";
import { logger } from "../lib/logger.js";

export function createBot(
	config: Config,
	store: SessionStore,
	mcpPool: McpProcessPool,
	dataDir: string
): Telegraf<BotContext> {
	const bot = new Telegraf<BotContext>(config.telegramBotToken);
	const messageQueue = new MessageQueue();

	bot.use(sessionMiddleware(store, config.encryptionSecret));
	bot.use(rateLimitMiddleware(config.rateLimitPerMinute));

	bot.start(startCommand);
	bot.help(helpCommand);
	bot.command("setup", setupCommand);
	bot.command("auth", createAuthCommand(config, mcpPool));
	bot.command("model", modelCommand);
	bot.command("status", createStatusCommand(mcpPool));
	bot.command("clear", clearCommand);
	bot.command("deletekey", createDeleteKeyCommand(mcpPool));

	const { handleCallback, routeAuthFlow } = createInteractionHandlers(config, mcpPool, dataDir);
	bot.on("callback_query", handleCallback);

	const handleMessage = createMessageHandler(config, mcpPool, messageQueue);

	bot.on("text", async (ctx) => {
		const consumed = await routeAuthFlow(ctx);
		if (consumed) return;

		if (!ctx.userSession) {
			await ctx.reply(
				"No AI model configured yet.\n\n" +
					"Use /setup to choose your provider, model, and enter your API key.",
				Markup.inlineKeyboard([Markup.button.callback("Setup AI Model", "action:setup")])
			);
			return;
		}

		await handleMessage(ctx);
	});

	bot.catch((err, ctx) => {
		logger.error("Bot error", {
			error: err instanceof Error ? err.message : String(err),
			updateType: ctx.updateType,
			userId: ctx.from?.id?.toString(),
		});
		ctx.reply("Something went wrong. Please try again.").catch(() => {
			/* best-effort */
		});
	});

	return bot;
}
