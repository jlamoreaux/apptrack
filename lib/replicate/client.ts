import Replicate from "replicate";
import { Models, ModelType } from "./models";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from "./config";
import { ChatMessage, CareerCoachOptions } from "./types";

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error("REPLICATE_API_TOKEN is not set");
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function callCareerCoach({
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  model = Models.default,
}: CareerCoachOptions): Promise<string> {
  try {
    // Format messages for Claude
    const systemMessage =
      messages.find((m) => m.role === "system")?.content ||
      DEFAULT_SYSTEM_PROMPT;

    const conversationMessages = messages.filter((m) => m.role !== "system");

    // Build the prompt for Claude
    let prompt = `${systemMessage}\n\nConversation:\n`;

    conversationMessages.forEach((message) => {
      const role = message.role === "user" ? "Human" : "Assistant";
      prompt += `${role}: ${message.content}\n`;
    });

    prompt += "Assistant:";

    const output = await replicate.run(model, {
      input: {
        prompt,
        max_tokens: maxTokens,
        temperature,
      },
    });

    // Handle the response - Replicate returns an array of strings
    if (Array.isArray(output)) {
      return output.join("");
    }

    return String(output);
  } catch (error) {
    console.error("Error calling Replicate API:", error);
    throw new Error("Failed to get career coaching response");
  }
}
