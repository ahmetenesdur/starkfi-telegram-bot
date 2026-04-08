import { marked, type Tokens, type RendererObject } from "marked";

const TELEGRAM_MAX_LENGTH = 4096;
const STARKNET_ADDR_REGEX = /0x[a-fA-F0-9]{40,66}/g;

// Custom Marked renderer — outputs only Telegram-supported HTML tags.
// This replaces the fragile post-parse regex chain.
// Ref: https://core.telegram.org/bots/api#html-style

const telegramRenderer: RendererObject = {
	// Headings → <b> (Telegram has no heading tags)
	heading({ tokens, depth: _depth }: Tokens.Heading): string {
		const text = this.parser.parseInline(tokens);
		return `<b>${text}</b>\n\n`;
	},

	// Paragraphs → plain text + double newline
	paragraph({ tokens }: Tokens.Paragraph): string {
		return `${this.parser.parseInline(tokens)}\n\n`;
	},

	// Bold → <b>
	strong({ tokens }: Tokens.Strong): string {
		return `<b>${this.parser.parseInline(tokens)}</b>`;
	},

	// Italic → <i>
	em({ tokens }: Tokens.Em): string {
		return `<i>${this.parser.parseInline(tokens)}</i>`;
	},

	// Strikethrough → <s>
	del({ tokens }: Tokens.Del): string {
		return `<s>${this.parser.parseInline(tokens)}</s>`;
	},

	// Inline code → <code>
	codespan({ text }: Tokens.Codespan): string {
		return `<code>${text}</code>`;
	},

	// Fenced code blocks → <pre><code>
	code({ text, lang }: Tokens.Code): string {
		if (lang) {
			return `<pre><code class="language-${lang}">${escapeHtml(text)}</code></pre>\n`;
		}
		return `<pre>${escapeHtml(text)}</pre>\n`;
	},

	// Blockquote → <blockquote> (supported by Telegram)
	blockquote({ tokens }: Tokens.Blockquote): string {
		const body = this.parser.parse(tokens);
		return `<blockquote>${body.trim()}</blockquote>\n`;
	},

	// Unordered list → bullet points
	list(token: Tokens.List): string {
		let body = "";
		for (let i = 0; i < token.items.length; i++) {
			const item = token.items[i];
			const prefix = token.ordered ? `${Number(token.start ?? 1) + i}. ` : "• ";
			body += `${prefix}${this.parser.parseInline(item.tokens)}\n`;
		}
		return `${body}\n`;
	},

	// List item (fallback — list() handles items directly)
	listitem(item: Tokens.ListItem): string {
		return `${this.parser.parseInline(item.tokens)}\n`;
	},

	// Links → <a href>
	link({ href, tokens }: Tokens.Link): string {
		const text = this.parser.parseInline(tokens);
		return `<a href="${href}">${text}</a>`;
	},

	// Images → Telegram can't render images in text, show as link
	image({ href, text }: Tokens.Image): string {
		return `<a href="${href}">[${text || "image"}]</a>`;
	},

	// Horizontal rule → visual separator
	hr(): string {
		return "─────\n\n";
	},

	// Line break → newline
	br(): string {
		return "\n";
	},

	// HTML passthrough (for any raw HTML in AI output)
	html({ text }: Tokens.HTML | Tokens.Tag): string {
		return text;
	},
};

marked.use({
	renderer: telegramRenderer,
	breaks: true,
	gfm: true,
});

// HTML entity escaping (for content inside <pre>/<code>)

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Address interception — wraps Starknet addresses with <code> for one-tap copy.
// MUST run AFTER marked parse to avoid breaking code blocks.

function interceptAddresses(html: string): string {
	// Split the HTML into segments: inside <code>/<pre> tags vs outside
	// We only want to replace addresses that are NOT already inside code tags
	const parts: string[] = [];
	let cursor = 0;
	const codeBlockRegex = /<(?:code|pre|a)[^>]*>[\s\S]*?<\/(?:code|pre|a)>/gi;

	let match: RegExpExecArray | null;
	while ((match = codeBlockRegex.exec(html)) !== null) {
		// Text before this code block — process addresses here
		if (match.index > cursor) {
			parts.push(replaceAddresses(html.slice(cursor, match.index)));
		}
		// Code block itself — leave untouched
		parts.push(match[0]);
		cursor = match.index + match[0].length;
	}

	// Remaining text after last code block
	if (cursor < html.length) {
		parts.push(replaceAddresses(html.slice(cursor)));
	}

	return parts.join("");
}

function replaceAddresses(text: string): string {
	return text.replace(STARKNET_ADDR_REGEX, (addr) => {
		if (addr.length <= 14) return addr;
		return `<code>${addr}</code>`;
	});
}

// Public API

export function sanitizeForTelegram(text: string): string {
	// Step 1: Parse markdown to Telegram-safe HTML via custom renderer
	const html = marked.parse(text, { async: false }) as string;

	// Step 2: Intercept Starknet addresses (only outside code blocks)
	const withAddresses = interceptAddresses(html);

	// Step 3: Clean up excessive whitespace
	return withAddresses.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Splits HTML text into chunks under TELEGRAM_MAX_LENGTH while keeping HTML tags balanced.
 */
export function chunkMessage(html: string): string[] {
	if (html.length <= TELEGRAM_MAX_LENGTH) return [html];

	const chunks: string[] = [];
	let remaining = html;

	while (remaining.length > 0) {
		if (remaining.length <= TELEGRAM_MAX_LENGTH) {
			chunks.push(remaining);
			break;
		}

		// Try to split at a natural line break
		let splitIndex = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);

		// Fallback to breaking at a space or just maximum boundary
		if (splitIndex <= 0) {
			splitIndex = remaining.lastIndexOf(" ", TELEGRAM_MAX_LENGTH);
			if (splitIndex <= 0) splitIndex = TELEGRAM_MAX_LENGTH;
		}

		const chunk = remaining.slice(0, splitIndex);

		// Balance unclosed Telegram HTML tags across chunk boundaries
		const openTags = getUnclosedTags(chunk);
		const closingTags = openTags
			.map((tag) => `</${tag}>`)
			.reverse()
			.join("");
		const reopeningTags = openTags.map((tag) => `<${tag}>`).join("");

		chunks.push(chunk + closingTags);

		remaining = remaining.slice(splitIndex).trimStart();
		if (remaining.length > 0 && reopeningTags) {
			remaining = reopeningTags + remaining;
		}
	}

	return chunks;
}

function getUnclosedTags(html: string): string[] {
	const tags: string[] = [];
	const tagRegex = /<\/?(b|i|u|s|code|pre|blockquote)([^>]*)>/gi;

	let match: RegExpExecArray | null;
	while ((match = tagRegex.exec(html)) !== null) {
		const isClosing = match[0].startsWith("</");
		const tagName = match[1].toLowerCase();

		if (isClosing) {
			const idx = tags.lastIndexOf(tagName);
			if (idx !== -1) tags.splice(idx, 1);
		} else {
			tags.push(tagName);
		}
	}
	return tags;
}
