import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { logger } from "../lib/logger.js";

export interface McpClientOptions {
	command: string;
	args: string[];
	userHome: string;
}

export async function createStarkfiMcpClient(options: McpClientOptions): Promise<MCPClient> {
	const { command, args, userHome } = options;

	logger.debug("Spawning MCP process", { command, args, userHome });

	// Isolated HOME ensures per-user session separation
	const transport = new Experimental_StdioMCPTransport({
		command,
		args,
		env: { ...process.env, HOME: userHome },
	});

	const client = await createMCPClient({ transport });

	logger.info("MCP client connected", { userHome });
	return client;
}
