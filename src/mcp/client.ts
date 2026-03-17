import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
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
	const childEnv = {
		...process.env,
		HOME: userHome,
		XDG_DATA_HOME: join(userHome, ".local", "share"),
		XDG_CONFIG_HOME: join(userHome, ".config"),
		XDG_CACHE_HOME: join(userHome, ".cache"),
		XDG_STATE_HOME: join(userHome, ".local", "state"),
	};

	const transport = new Experimental_StdioMCPTransport({
		command,
		args,
		env: childEnv,
	});

	const client = await createMCPClient({ transport });

	logger.info("MCP client connected", { userHome });
	return client;
}

