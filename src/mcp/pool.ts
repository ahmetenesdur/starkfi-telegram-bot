import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MCPClient } from "@ai-sdk/mcp";
import { createStarkfiMcpClient } from "./client.js";
import { logger } from "../lib/logger.js";

export type McpToolSet = Awaited<ReturnType<MCPClient["tools"]>>;

interface PoolEntry {
	client: MCPClient;
	tools: McpToolSet;
	lastUsed: number;
}

export class McpProcessPool {
	private pool = new Map<string, PoolEntry>();
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private dataDir: string,
		private mcpCommand: string,
		private mcpArgs: string[],
		private idleTimeoutMs = 300_000
	) {}

	async getClient(userId: string): Promise<{ client: MCPClient; tools: McpToolSet }> {
		const entry = this.pool.get(userId);
		if (entry) {
			// Validate the cached client is still alive
			try {
				entry.tools = await entry.client.tools();
			} catch {
				logger.warn("Stale MCP client detected, reconnecting", { userId });
				await this.removeClient(userId);
				return this.getClient(userId);
			}
			entry.lastUsed = Date.now();
			return { client: entry.client, tools: entry.tools };
		}

		const userHome = join(this.dataDir, "users", userId);
		await mkdir(userHome, { recursive: true });

		try {
			const client = await createStarkfiMcpClient({
				command: this.mcpCommand,
				args: this.mcpArgs,
				userHome,
			});

			const tools = await client.tools();

			this.pool.set(userId, { client, tools, lastUsed: Date.now() });
			logger.info("MCP process spawned", { userId });
			return { client, tools };
		} catch (error) {
			logger.error("Failed to spawn MCP process", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Error("Failed to connect to StarkFi service. Please try again.", {
				cause: error,
			});
		}
	}

	async removeClient(userId: string): Promise<void> {
		const entry = this.pool.get(userId);
		if (!entry) return;

		try {
			await entry.client.close();
			logger.debug("MCP process closed", { userId });
		} catch {
			logger.warn("MCP close failed (may already be dead)", { userId });
		}
		this.pool.delete(userId);
	}

	startCleanup(): void {
		if (this.cleanupTimer) return;

		this.cleanupTimer = setInterval(async () => {
			const now = Date.now();
			const promises: Promise<void>[] = [];

			for (const [userId, entry] of this.pool) {
				if (now - entry.lastUsed > this.idleTimeoutMs) {
					promises.push(this.removeClient(userId));
				}
			}

			if (promises.length > 0) {
				logger.info("Cleaning up idle MCP processes", {
					count: promises.length,
				});
				await Promise.allSettled(promises);
			}
		}, 60_000);
		this.cleanupTimer.unref();
	}

	async shutdown(): Promise<void> {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		const promises: Promise<void>[] = [];
		for (const userId of this.pool.keys()) {
			promises.push(this.removeClient(userId));
		}

		if (promises.length > 0) {
			logger.info("Shutting down all MCP processes", { count: promises.length });
			await Promise.allSettled(promises);
		}
	}

	get activeCount(): number {
		return this.pool.size;
	}
}
