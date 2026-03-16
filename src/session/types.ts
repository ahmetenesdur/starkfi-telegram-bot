import type { ModelMessage } from "ai";

export type Provider = "openai" | "claude" | "gemini";

export interface UserSession {
	userId: string;
	provider: Provider;
	encryptedKey: Buffer;
	iv: Buffer;
	authTag: Buffer;
	modelName: string;
	starkfiAddr: string | null;
	history: ModelMessage[];
	createdAt: number;
	updatedAt: number;
}

export const MODEL_DEFAULTS: Record<Provider, string> = {
	openai: "gpt-4o",
	claude: "claude-sonnet-4-20250514",
	gemini: "gemini-2.5-flash",
};

export const PROVIDER_LABELS: Record<Provider, string> = {
	openai: "OpenAI",
	claude: "Claude (Anthropic)",
	gemini: "Gemini (Google)",
};
