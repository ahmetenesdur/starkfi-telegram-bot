import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { execSync } from "node:child_process";
import { logger } from "../lib/logger.js";

export interface McpClientOptions {
	command: string;
	args: string[];
	userHome: string;
}

export async function createStarkfiMcpClient(options: McpClientOptions): Promise<MCPClient> {
	const { command, args, userHome } = options;

	logger.debug("Spawning MCP process", { command, args, userHome });

	const childEnv = { ...process.env, HOME: userHome };

	// Debug: verify what HOME the child process actually sees
	try {
		const testScript = `console.log(JSON.stringify({
			HOME: process.env.HOME,
			homedir: require("os").homedir(),
			envPaths: (() => { try { return require("env-paths")("starkfi").data } catch { return "not-found" } })()
		}))`;
		const result = execSync(`node -e '${testScript}'`, {
			env: childEnv,
			timeout: 5000,
		}).toString().trim();
		logger.info("MCP env verification", { expected: userHome, childResult: result });
	} catch (e) {
		logger.warn("MCP env verification failed", {
			error: e instanceof Error ? e.message : String(e),
		});
	}

	// Isolated HOME ensures per-user session separation
	const transport = new Experimental_StdioMCPTransport({
		command,
		args,
		env: childEnv,
	});

	const client = await createMCPClient({ transport });

	logger.info("MCP client connected", { userHome });
	return client;
}
