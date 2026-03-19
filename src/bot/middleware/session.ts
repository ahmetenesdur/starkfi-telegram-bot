import type { Context, MiddlewareFn } from "telegraf";
import type { SessionStore } from "../../session/store.js";
import type { UserSession } from "../../session/types.js";

export interface BotContext extends Context {
	store: SessionStore;
	encryptionSecret: string;
	userSession: UserSession | null;
}

export function sessionMiddleware(
	store: SessionStore,
	encryptionSecret: string
): MiddlewareFn<BotContext> {
	return async (ctx, next) => {
		ctx.store = store;
		ctx.encryptionSecret = encryptionSecret;
		ctx.userSession = ctx.from ? store.get(ctx.from.id.toString()) : null;
		return next();
	};
}
