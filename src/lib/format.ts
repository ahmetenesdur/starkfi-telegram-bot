import { marked } from "marked";

const TELEGRAM_MAX_LENGTH = 4096;
const STARKNET_ADDR_REGEX = /0x[a-fA-F0-9]{40,66}/g;

export function sanitizeForTelegram(text: string): string {
	// Intercept Starknet addresses before markdown parsing to apply Magic Copy
	let processedText = text;
	
	// Process Starknet addresses to make them copyable but truncated visually
	processedText = processedText.replace(STARKNET_ADDR_REGEX, (match) => {
		if (match.length <= 14) return match;
		const truncated = `${match.slice(0, 6)}...${match.slice(-4)}`;
		return `<a href="tg://copy?text=${match}">${truncated}</a>`;
	});

	// Parse with marked
    // 'breaks: true' turns newlines into <br> matching Telegram's expected flow
	const rawHtml = marked.parse(processedText, { async: false, breaks: true }) as string;

	// Map generic HTML to Telegram-supported HTML
	return rawHtml
		.replace(/<p>([\s\S]*?)<\/p>/g, "$1\n\n")
		.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g, "<b>$1</b>\n\n")
		.replace(/<ul[^>]*>/g, "")
		.replace(/<\/ul>/g, "\n")
		.replace(/<ol[^>]*>/g, "")
		.replace(/<\/ol>/g, "\n")
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, "• $1\n")
		.replace(/<br\s*\/?>/g, "\n")
		.replace(/<strong>/g, "<b>")
		.replace(/<\/strong>/g, "</b>")
		.replace(/<em>/g, "<i>")
		.replace(/<\/em>/g, "</i>")
		.replace(/<hr[^>]*>/g, "─────\n\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
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
		
		// Attempt to balance simple Telegram HTML tags: <b>, <i>, <code>, <pre>, <u>, <s>
        // A minimal tag-balancer that closes unclosed tags at the end of the chunk
        // and reopens them at the start of the next chunk.
		const openTags = getUnclosedTags(chunk);
		const closingTags = openTags.map(tag => `</${tag}>`).reverse().join("");
		const reopeningTags = openTags.map(tag => `<${tag}>`).join("");

		chunks.push(chunk + closingTags);
		
		remaining = remaining.slice(splitIndex).trimStart();
		if (remaining.length > 0 && reopeningTags) {
			remaining = reopeningTags + remaining;
		}
	}

	return chunks;
}

function getUnclosedTags(html: string): string[] {
	const tags = [];
	// This regex matches simple specific tags we care about. 
    // `a` tags are assumed to not span chunks (they don't span paragraphs generally).
	const tagRegex = /<\/?(b|i|u|s|code|pre)([^>]*)>/ig;
	
	let match;
	while ((match = tagRegex.exec(html)) !== null) {
		const isClosing = match[0].startsWith("</");
		const tagName = match[1].toLowerCase();

		if (isClosing) {
			// Remove the last matching tag
			const idx = tags.lastIndexOf(tagName);
			if (idx !== -1) tags.splice(idx, 1);
		} else {
			tags.push(tagName);
		}
	}
	return tags;
}
