"use server";

import { executeIntent } from "@/lib/action-engine";
import { parseIntent } from "@/lib/openai";

export async function handleChatMessage(input: string) {
  if (!input.trim()) {
    return {
      ok: false,
      assistantMessage: "Please type a message."
    };
  }

  try {
    const parsed = await parseIntent(input);
    const result = await executeIntent(parsed);

    return {
      ok: result.success,
      assistantMessage: result.message,
      parsedIntent: parsed
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error processing message.";

    return {
      ok: false,
      assistantMessage: `Error: ${message}`
    };
  }
}
