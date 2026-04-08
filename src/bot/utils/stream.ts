import { TelegramError } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { sanitizeForTelegram, chunkMessage } from "../../lib/format.js";
import { logger } from "../../lib/logger.js";

const EDIT_DELAY_MS = 600;

export class StarkFiStreamManager {
	private ctx: BotContext;
	private messageId: number | null = null;
	private fullText = "";
	private isEditing = false;
	private pendingEdit = false;
	private editCount = 0;
	private isFinal = false;

	constructor(ctx: BotContext) {
		this.ctx = ctx;
	}

	async initialize() {
		// Send initial status
		const msg = await this.ctx.reply("🤔 Düşünüyor...", { parse_mode: "HTML" });
		this.messageId = msg.message_id;
	}

	async appendChunk(chunk: string) {
		this.fullText += chunk;
		this.scheduleEdit();
	}

	/**
	 * Should be called when the AI finishes generating entirely.
	 */
	async finalize() {
		this.isFinal = true;
		
		// If an edit is currently happening, we'll let it finish and trigger a final edit.
		// Otherwise we just trigger it immediately.
		if (!this.isEditing) {
			await this.executeEdit();
		}
	}

	private scheduleEdit() {
		if (this.isEditing) {
			this.pendingEdit = true;
			return;
		}

		// Implement batching to avoid spamming the edit API (Telegram rate limits)
		// We use a small timeout to let chunks accumulate
		this.isEditing = true;
		setTimeout(() => {
			this.executeEdit().catch(err => {
				logger.error("Stream update error", { error: String(err) });
				this.isEditing = false;
				
				// Retry if pending
				if (this.pendingEdit && !this.isFinal) {
					this.pendingEdit = false;
					this.scheduleEdit();
				}
			});
		}, EDIT_DELAY_MS);
	}

    /**
     * Replaces the old typing indicator method. 
     */
	async refreshTypingStatus() {
		try {
			await this.ctx.sendChatAction("typing");
		} catch {
			// best effort
		}
	}

	private async executeEdit() {
		if (!this.messageId) return;

		let textToRender = this.fullText.trim();
		if (!textToRender) textToRender = "🤔 Düşünüyor...";

		// Add a typing indicator suffix if stream is still ongoing
		if (!this.isFinal && !textToRender.endsWith("▌")) {
			textToRender += " ▌";
		}

		// Sanitize to Telegram HTML and apply Magic Copy Interceptor
		const sanitizedHtml = sanitizeForTelegram(textToRender);
		
		// Telegram max message length is 4096. 
		// If text is larger than 4096, we only want to edit the LAST chunk to show progress!
		// But chunkMessage splits the entire text into multiple messages.
		// For streaming, we'll just handle the first chunk. If it gets too long,
		// we'll leave that logic to chunkMessage at the end.
		
		// Wait, if it exceeds length, chunkMessage gives us chunks.
		const chunks = chunkMessage(sanitizedHtml);
        
		// For the live-streaming edits, we only update the LAST message chunk if we implement multi-message streaming.
		// For simplicity, we stream into the first message until full, 
		// and at the VERY END, we split and send new messages for remaining chunks.
		const currentDisplayChunk = chunks[0];

		try {
			await this.editWithRetry(currentDisplayChunk);
		} finally {
			this.isEditing = false;
			this.editCount++;

			// If there's new text waiting, immediately schedule the next edit
			if (this.pendingEdit && !this.isFinal) {
				this.pendingEdit = false;
				this.scheduleEdit();
			} else if (this.isFinal && chunks.length > 1) {
				// If we have finalized and there's more than 1 chunk, we need to send the extra chunks
				for (let i = 1; i < chunks.length; i++) {
					try {
						await this.ctx.reply(chunks[i], { parse_mode: "HTML" });
					} catch (e) {
						logger.warn("Failed to send chunk with HTML mode, falling back", { error: e });
						await this.ctx.reply(chunks[i]);
					}
				}
			}
		}
	}

	private async editWithRetry(text: string) {
		const maxRetries = 2; // Minimal retry loop
		let retries = 0;

		while (retries < maxRetries) {
			try {
				await this.ctx.telegram.editMessageText(
					this.ctx.chat?.id,
					this.messageId!,
					undefined,
					text,
					{ parse_mode: "HTML" }
				);
				return;
			} catch (err: unknown) {
				const error = err as Error & { code?: number; parameters?: { retry_after?: number } };
				// If the text is the same (Telegram throws a specific error if message content is not modified)
				if (error.message?.includes("message is not modified")) {
					return;
				}

				if (error instanceof TelegramError && error.code === 429) {
					const retryAfter = error.parameters?.retry_after || 1;
					logger.warn(`Rate limited during stream. Waiting ${retryAfter}s`);
					await new Promise((r) => setTimeout(r, retryAfter * 1000));
					retries++;
					continue;
				}

				// If the chunk failed to parse (maybe tags unbalanced during live stream)
                // Fall back to plain text
				if (error.message?.includes("can't parse entities")) {
                    await this.ctx.telegram.editMessageText(
                        this.ctx.chat?.id,
                        this.messageId!,
                        undefined,
                        // strip HTML tags as last resort
                        text.replace(/<[^>]*>?/gm, ''), 
                        { parse_mode: undefined }
                    );
                    return;
                }
				
				throw error;
			}
		}
	}
}
