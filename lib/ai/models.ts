// WeatherGPT — Language Model Factory
// Configures provider adapters (Google Gemini or OpenAI) from environment keys.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export const MODEL_GENERATION_CONFIG = {
  temperature: 0.2, // Low temperature strictly enforces factual adherence to IMD meteorological tables
  maxTokens: 1024,
};

export function getLanguageModel() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey && geminiKey.trim()) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey.trim() });
    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    return google(modelName);
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey.trim()) {
    const openai = createOpenAI({ apiKey: openAiKey.trim() });
    const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    return openai(modelName);
  }

  return null;
}

