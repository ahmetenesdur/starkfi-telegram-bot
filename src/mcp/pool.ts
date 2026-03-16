import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { MCPClient } from "@ai-sdk/mcp";
import { createStarkfiMcpClient } from "./client.js";
import { logger } from "../lib/logger.js";

interface PoolEntry {
	client: MCPClient;
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

	async getClient(userId: string): Promise<MCPClient> {
		const entry = this.pool.get(userId);
		if (entry) {
			entry.lastUsed = Date.now();
			return entry.client;
		}

		const userHome = join(this.dataDir, "users", userId);
		await mkdir(userHome, { recursive: true });

		try {
			const client = await createStarkfiMcpClient({
				command: this.mcpCommand,
				args: this.mcpArgs,
				userHome,
			});

			this.pool.set(userId, { client, lastUsed: Date.now() });
			logger.info("MCP process spawned", { userId });
			return client;
		} catch (error) {
			logger.error("Failed to spawn MCP process", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
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
			const toRemove: string[] = [];

			for (const [userId, entry] of this.pool) {
				if (now - entry.lastUsed > this.idleTimeoutMs) {
					toRemove.push(userId);
				}
			}

			if (toRemove.length > 0) {
				logger.info("Cleaning up idle MCP processes", {
					count: toRemove.length,
				});
				await Promise.allSettled(toRemove.map((id) => this.removeClient(id)));
			}
		}, 60_000);
	}

	async shutdown(): Promise<void> {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		const userIds = [...this.pool.keys()];
		if (userIds.length > 0) {
			logger.info("Shutting down all MCP processes", { count: userIds.length });
			await Promise.allSettled(userIds.map((id) => this.removeClient(id)));
		}
	}

	get activeCount(): number {
		return this.pool.size;
	}
}
