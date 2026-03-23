const TELEGRAM_MAX_LENGTH = 4096;

export function sanitizeForTelegram(text: string): string {
	return text
		.replace(/\*\*([^\n]+?)\*\*/g, "*$1*")
		.replace(/__([^\n]+?)__/g, "*$1*")
		.replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
		.replace(/^-{3,}$/gm, "")
		.replace(/\n{3,}/g, "\n\n");
}

export function chunkMessage(text: string): string[] {
	if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > 0) {
		if (remaining.length <= TELEGRAM_MAX_LENGTH) {
			chunks.push(remaining);
			break;
		}

		const cutoff = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
		const end = cutoff > 0 ? cutoff : TELEGRAM_MAX_LENGTH;

		chunks.push(remaining.slice(0, end));
		remaining = remaining.slice(end === cutoff ? end + 1 : end);
	}

	return chunks;
}

export function truncateAddress(address: string): string {
	if (address.length <= 14) return address;
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
