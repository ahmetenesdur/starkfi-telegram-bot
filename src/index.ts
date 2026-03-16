import { join } from "node:path";
import { mkdirSync } from "node:fs";
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

	// process.once prevents double-shutdown on repeated signals
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

	await bot.launch();
	logger.info("Bot is running — press Ctrl+C to stop");
}

main().catch((error) => {
	logger.error("Fatal error", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exit(1);
});
