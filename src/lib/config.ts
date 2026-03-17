export interface Config {
	telegramBotToken: string;
	encryptionSecret: string;
	starkfiServerUrl: string;
	webhookUrl?: string;
	webhookSecret?: string;
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

function parseIntEnv(key: string, fallback: number): number {
	const raw = process.env[key];
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (Number.isNaN(parsed) || parsed < 0) {
		throw new Error(`${key} must be a non-negative number, got: "${raw}"`);
	}
	return parsed;
}

export function loadConfig(): Config {
	const encryptionSecret = requireEnv("BOT_ENCRYPTION_SECRET");
	if (!/^[0-9a-f]{64}$/i.test(encryptionSecret)) {
		throw new Error("BOT_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes)");
	}

	const webhookUrl = process.env.WEBHOOK_URL?.replace(/\/+$/, "") || undefined;
	const webhookSecret = process.env.WEBHOOK_SECRET || undefined;

	if (webhookUrl && !webhookSecret) {
		throw new Error(
			"WEBHOOK_SECRET is required when WEBHOOK_URL is set. " +
				"Generate one with: openssl rand -hex 32"
		);
	}

	if (webhookSecret && !/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
		throw new Error(
			"WEBHOOK_SECRET must be 1-256 characters, containing only A-Z, a-z, 0-9, _ or -"
		);
	}

	return {
		telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
		encryptionSecret,
		starkfiServerUrl: requireEnv("STARKFI_SERVER_URL"),
		webhookUrl,
		webhookSecret,
		mcpCommand: process.env.STARKFI_MCP_COMMAND ?? "npx",
		mcpArgs: (process.env.STARKFI_MCP_ARGS ?? "-y,starkfi@latest,mcp-start").split(","),
		logLevel: parseLogLevel(process.env.LOG_LEVEL),
		maxHistory: parseIntEnv("MAX_HISTORY", 20),
		rateLimitPerMinute: parseIntEnv("RATE_LIMIT_PER_MINUTE", 30),
		mcpIdleTimeoutMs: parseIntEnv("MCP_IDLE_TIMEOUT_MS", 300_000),
	};
}
