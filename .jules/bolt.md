## 2025-03-17 - Redundant MCP IPC Calls Avoided
**Learning:** `mcpClient.tools()` from `@ai-sdk/mcp` makes a full RPC request (via stdio `listTools`) every time it is called. Doing this repeatedly per message introduces unnecessary latency since MCP tools are generally static per session.
**Action:** When validating a cached MCP client, save and pass the resulting tools array down to `processMessage` (or just cache it) rather than re-requesting it in the router.
