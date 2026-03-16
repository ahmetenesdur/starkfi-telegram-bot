export interface Config {
	telegramBotToken: string;
	encryptionSecret: string;
	starkfiServerUrl: string;
	mcpCommand: string;
	mcpArgs: string[];
	logLevel: LogLevel;
	maxHistory: number;
	rateLimitPerMinute: number;
	mcpIdleTimeoutMs: number;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

const VALID_LOG_LEVELS = new Set<string>(["debug", "info", "warn", "error"]);

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function parseLogLevel(raw: string | undefined): LogLevel {
	const level = raw?.toLowerCase();
	if (level && VALID_LOG_LEVELS.has(level)) return level as LogLevel;
	return "info";
}

export function loadConfig(): Config {
	return {
		telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
		encryptionSecret: requireEnv("BOT_ENCRYPTION_SECRET"),
		starkfiServerUrl: requireEnv("STARKFI_SERVER_URL"),
		mcpCommand: process.env.STARKFI_MCP_COMMAND ?? "npx",
		mcpArgs: (process.env.STARKFI_MCP_ARGS ?? "-y,starkfi@latest,mcp-start").split(","),
		logLevel: parseLogLevel(process.env.LOG_LEVEL),
		maxHistory: Number(process.env.MAX_HISTORY ?? "20"),
		rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? "30"),
		mcpIdleTimeoutMs: Number(process.env.MCP_IDLE_TIMEOUT_MS ?? "300000"),
	};
}
