import type { Config } from "./config.js";

type LogLevel = Config["logLevel"];

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
	currentLevel = level;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
	if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return;

	const entry: Record<string, unknown> = {
		timestamp: new Date().toISOString(),
		level,
		message,
	};

	if (data) entry.data = data;

	const output = JSON.stringify(entry) + "\n";

	// warn and error go to stderr for proper log routing
	if (level === "warn" || level === "error") {
		process.stderr.write(output);
	} else {
		process.stdout.write(output);
	}
}

export const logger = {
	debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
	info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
	warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
	error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
