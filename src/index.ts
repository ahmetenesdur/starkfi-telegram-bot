import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { loadConfig } from "./lib/config.js";
import { logger, setLogLevel } from "./lib/logger.js";
import { SessionStore } from "./session/store.js";
import { McpProcessPool } from "./mcp/pool.js";
import { createBot } from "./bot/bot.js";

async function main(): Promise<void> {
	const config = loadConfig();
	setLogLevel(config.logLevel);

	const dataDir = join(process.cwd(), ".data");
	mkdirSync(dataDir, { recursive: true });

	const dbPath = join(dataDir, "sessions.db");
	const store = new SessionStore(dbPath, config.encryptionSecret);

	const mcpPool = new McpProcessPool(
		dataDir,
		config.mcpCommand,
		config.mcpArgs,
		config.mcpIdleTimeoutMs
	);
	mcpPool.startCleanup();

	const bot = createBot(config, store, mcpPool, dataDir);

	// Guard against double-shutdown on repeated signals
	let isShuttingDown = false;

	async function shutdown(signal: string): Promise<void> {
		if (isShuttingDown) return;
		isShuttingDown = true;

		logger.info(`${signal} received — shutting down`);
		bot.stop(signal);
		await mcpPool.shutdown();
		store.close();
		process.exit(0);
	}

	process.once("SIGINT", () => shutdown("SIGINT"));
	process.once("SIGTERM", () => shutdown("SIGTERM"));

	logger.info("Starting StarkFi Telegram Bot", {
		mcpCommand: config.mcpCommand,
		logLevel: config.logLevel,
	});

	const port = Number(process.env.PORT) || 8080;

	if (config.webhookUrl) {
		// Webhook mode (App Runner / production)
		await bot.launch({
			webhook: {
				domain: config.webhookUrl,
				port,
				path: `/webhook/${config.webhookSecret}`,
				secretToken: config.webhookSecret,
			},
		});
		logger.info("Bot running in webhook mode", { port });
	} else {
		// Long polling mode (local development)
		createServer((_, res) => {
			res.writeHead(200);
			res.end("OK");
		}).listen(port, () => {
			logger.info(`Health check server on port ${port}`);
		});
		await bot.launch();
		logger.info("Bot running in polling mode");
	}
}

main().catch((error) => {
	logger.error("Fatal error", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exit(1);
});
