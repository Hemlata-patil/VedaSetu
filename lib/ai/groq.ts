import "server-only";
import Groq from "groq-sdk";

/**
 * Recommended Groq AI models for Veda Setu AYUSH domain tasks.
 */
export const GROQ_MODELS = {
  /** High performance multilingual & reasoning model for clinical/career recommendations */
  DEFAULT: "qwen/qwen3.8-27b",
  /** Deep reasoning & large context model */
  GPT_OSS_120B: "openai/gpt-oss-120b",
  /** Compact model */
  GPT_OSS_20B: "openai/gpt-oss-20b",
} as const;

export type GroqModel = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

let groqInstance: Groq | null = null;

/**
 * Returns an authenticated, server-only Groq SDK client instance.
 * Reads GROQ_API_KEY from environment variables without exposing secrets.
 */
export function getGroqClient(): Groq {
  if (groqInstance) {
    return groqInstance;
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "GROQ_API_KEY environment variable is missing or empty. Please set GROQ_API_KEY in .env.local"
    );
  }

  groqInstance = new Groq({
    apiKey: apiKey.trim(),
  });

  return groqInstance;
}
