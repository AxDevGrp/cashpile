import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getDeepSeekClient(): OpenAI {
  if (!_client) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is required");
    }
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return _client;
}

// Keep for backwards compatibility during migration
export function getOpenAIClient(): OpenAI {
  return getDeepSeekClient();
}

export const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
export const FAST_MODEL = process.env.DEEPSEEK_FAST_MODEL ?? "deepseek-chat";
