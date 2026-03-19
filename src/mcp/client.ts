import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { logger } from "../lib/logger.js";

export interface McpClientOptions {
	command: string;
	args: string[];
	userHome: string;
}

export async function createStarkfiMcpClient(options: McpClientOptions): Promise<MCPClient> {
	const { command, args, userHome } = options;

	logger.debug("Spawning MCP process", { command, args, userHome });

	// Force XDG paths so env-paths resolves correctly regardless of os.homedir()
	const childEnv: Record<string, string> = {
		...(process.env as Record<string, string>),
		HOME: userHome,
		XDG_DATA_HOME: join(userHome, ".local", "share"),
		XDG_CONFIG_HOME: join(userHome, ".config"),
		XDG_CACHE_HOME: join(userHome, ".cache"),
		XDG_STATE_HOME: join(userHome, ".local", "state"),
	};

	const transport = new StdioClientTransport({
		command,
		args,
		env: childEnv,
	});

	const client = await createMCPClient({ transport });

	logger.info("MCP client connected", { userHome });
	return client;
}
