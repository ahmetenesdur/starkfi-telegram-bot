const TELEGRAM_MAX_LENGTH = 4096;

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
		// Hard-cut if no newline found, to prevent infinite loop
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
