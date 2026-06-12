import OpenAI from "openai";

let client: OpenAI | null = null;

export function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
