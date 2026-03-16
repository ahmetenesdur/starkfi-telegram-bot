import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { Provider } from "../session/types.js";

export function createModel(provider: Provider, apiKey: string, modelName: string): LanguageModel {
	switch (provider) {
		case "openai":
			return createOpenAI({ apiKey })(modelName);
		case "claude":
			return createAnthropic({ apiKey })(modelName);
		case "gemini":
			return createGoogleGenerativeAI({ apiKey })(modelName);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
