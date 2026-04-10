import { TelegramError } from "telegraf";
import type { BotContext } from "../middleware/session.js";
import { sanitizeForTelegram, chunkMessage } from "../../lib/format.js";
import { logger } from "../../lib/logger.js";

const EDIT_DELAY_MS = 600;

// Template emojis used in system prompt templates.
// Any text appearing BEFORE the first occurrence of one of these is considered
// conversational filler (e.g., "Let me fetch...") and will be stripped.
const TEMPLATE_EMOJI_REGEX =
	/\u{1F4B3}|\u{1F50D}|\u{2705}|\u{26A0}\u{FE0F}?|\u{1F4B0}|\u{1F969}|\u{26A1}\u{FE0F}?|\u{1F680}|\u{1F3E6}|\u{1F4CA}|\u{1FA69}|\u{1F517}/u;

export class StarkFiStreamManager {
	private ctx: BotContext;
	private messageId: number | null = null;
	private fullText = "";
	private statusText = "";
	private isEditing = false;
	private pendingEdit = false;
	private editCount = 0;
	private isFinal = false;
	private finalizeResolve: (() => void) | null = null;
	private abortSignal?: AbortSignal;

	constructor(ctx: BotContext, abortSignal?: AbortSignal) {
		this.ctx = ctx;
		this.abortSignal = abortSignal;
	}

	async initialize() {
		const msg = await this.ctx.reply("<i>Processing...</i>", { parse_mode: "HTML" });
		this.messageId = msg.message_id;
	}

	async appendChunk(chunk: string) {
		if (this.abortSignal?.aborted) return;
		this.fullText += chunk;
		this.scheduleEdit();
	}

	/**
	 * Updates the status line shown while the AI is working (e.g., tool call in progress).
	 * Only visible when the stream has no text output yet.
	 */
	updateStatus(label: string) {
		this.statusText = label;
		if (!this.fullText.trim()) {
			this.scheduleEdit();
		}
	}

	/**
	 * Should be called when the AI finishes generating entirely.
	 * Returns a Promise that resolves after the final edit is delivered.
	 */
	async finalize() {
		this.isFinal = true;

		if (!this.isEditing) {
			await this.executeEdit();
		} else {
			// An edit is in flight — wait for it to finish, then it will trigger the final edit
			await new Promise<void>((resolve) => {
				this.finalizeResolve = resolve;
			});
		}
	}

	private scheduleEdit() {
		if (this.isEditing) {
			this.pendingEdit = true;
			return;
		}

		this.isEditing = true;
		setTimeout(() => {
			this.executeEdit().catch((err) => {
				logger.error("Stream update error", { error: String(err) });
				this.isEditing = false;

				if (this.pendingEdit && !this.isFinal) {
					this.pendingEdit = false;
					this.scheduleEdit();
				}

				// If we were waiting on finalize, resolve it even on error
				if (this.isFinal && this.finalizeResolve) {
					this.finalizeResolve();
					this.finalizeResolve = null;
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

	// Strips conversational preamble text that appears before the first template emoji.
	// Example: "Let me fetch your balances! 💰 Balances" → "💰 Balances"
	private stripPreamble(text: string): string {
		const match = TEMPLATE_EMOJI_REGEX.exec(text);
		if (match && match.index > 0) {
			return text.slice(match.index);
		}
		return text;
	}

	private async executeEdit() {
		if (!this.messageId) return;

		let textToRender = this.stripPreamble(this.fullText.trim());
		if (!textToRender) {
			// Show status text while AI is working but no text output yet
			textToRender = this.statusText
				? `<i>${this.statusText}...</i>`
				: "<i>Processing...</i>";
		}

		// Sanitize to Telegram HTML and apply address interception
		const sanitizedHtml = sanitizeForTelegram(textToRender);
		const chunks = chunkMessage(sanitizedHtml);

		// During streaming, edit only the first message chunk.
		// On finalize, send remaining chunks as new messages.
		const currentDisplayChunk = chunks[0];

		try {
			await this.editWithRetry(currentDisplayChunk);
		} finally {
			this.isEditing = false;
			this.editCount++;

			if (this.pendingEdit && !this.isFinal) {
				this.pendingEdit = false;
				this.scheduleEdit();
			} else if (this.isFinal) {
				// Deliver remaining chunks if message was too long
				if (chunks.length > 1) {
					for (let i = 1; i < chunks.length; i++) {
						try {
							await this.ctx.reply(chunks[i], { parse_mode: "HTML" });
						} catch (e) {
							logger.warn("Failed to send chunk with HTML, falling back", {
								error: e,
							});
							await this.ctx.reply(chunks[i]);
						}
					}
				}

				// If there's still a pending edit (text arrived between last batch and finalize),
				// do one more pass, then resolve
				if (this.pendingEdit) {
					this.pendingEdit = false;
					await this.executeEdit();
				}

				// Resolve the finalize() promise
				if (this.finalizeResolve) {
					this.finalizeResolve();
					this.finalizeResolve = null;
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
					{ parse_mode: "HTML", link_preview_options: { is_disabled: true } }
				);
				return;
			} catch (err: unknown) {
				const error = err as Error & {
					code?: number;
					parameters?: { retry_after?: number };
				};
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
						text.replace(/<[^>]*>?/gm, ""),
						{ parse_mode: undefined }
					);
					return;
				}

				throw error;
			}
		}
	}
}
