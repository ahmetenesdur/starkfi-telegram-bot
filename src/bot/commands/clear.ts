import type { BotContext } from "../middleware/session.js";

export async function clearCommand(ctx: BotContext): Promise<void> {
	const userId = ctx.from?.id?.toString();
	if (!userId) return;

	ctx.store.clearHistory(userId);
	await ctx.reply("Conversation history cleared. Start fresh!");
}
