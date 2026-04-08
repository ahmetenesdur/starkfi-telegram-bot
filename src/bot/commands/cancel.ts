import type { BotContext } from "../middleware/session.js";

// Per-user AbortController registry for cancelling active AI streams
const activeStreams = new Map<string, AbortController>();

export function getAbortController(userId: string): AbortController {
	// Abort any existing stream for this user
	const existing = activeStreams.get(userId);
	if (existing) {
		existing.abort();
	}

	const controller = new AbortController();
	activeStreams.set(userId, controller);
	return controller;
}

export function clearAbortController(userId: string): void {
	activeStreams.delete(userId);
}

export async function cancelCommand(ctx: BotContext): Promise<void> {
	const userId = ctx.from?.id?.toString();
	if (!userId) return;

	const controller = activeStreams.get(userId);
	if (controller) {
		controller.abort();
		activeStreams.delete(userId);
		await ctx.reply("Operation cancelled.", { parse_mode: "HTML" });
	} else {
		await ctx.reply("No active operation to cancel.");
	}
}
