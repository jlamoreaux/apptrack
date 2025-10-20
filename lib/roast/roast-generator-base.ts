import OpenAI from "openai";
import { Models } from "@/lib/openai/models";

// Reuse singleton pattern from lib/openai/client.ts
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export interface RoastCategories {
  buzzwordBingo: boolean;
  lengthCrimes: boolean;
  formattingDisasters: boolean;
  skillsInflation: boolean;
  genericDisease: boolean;
  industryMisalignment: boolean;
}

export interface RoastResult {
  content: string;
  emojiScore: string;
  scoreLabel: string;
  tagline: string;
  categories: RoastCategories;
  firstName: string | null;
}

export interface RoastConfig {
  prompt: string;
  systemMessage: string;
  signOffs: string[];
  fallbackContent: (firstName: string | null) => string;
  fallbackScore: string;
  fallbackLabel: string;
  fallbackTagline: string;
}

export async function generateRoastBase(
  resumeText: string,
  firstName: string | null,
  config: RoastConfig
): Promise<RoastResult> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: Models.default,
      messages: [
        {
          role: "system",
          content: config.systemMessage,
        },
        {
          role: "user",
          content: config.prompt + resumeText,
        },
      ],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");
    
    // Personalize with first name if available
    let roastContent = response.roast;
    if (firstName) {
      roastContent = `${firstName}, oh ${firstName}... what have you done?\n\n${roastContent}`;
    } else {
      roastContent = `Oh no... oh no no no...\n\n${roastContent}`;
    }
    
    // Add sign-offs
    const signOff = config.signOffs[Math.floor(Math.random() * config.signOffs.length)];
    roastContent += signOff.replace('${response.emojiScore}', response.emojiScore);

    return {
      content: roastContent,
      emojiScore: response.emojiScore || config.fallbackScore,
      scoreLabel: response.scoreLabel || config.fallbackLabel,
      tagline: response.tagline || config.fallbackTagline,
      categories: response.categories || {
        buzzwordBingo: false,
        lengthCrimes: false,
        formattingDisasters: false,
        skillsInflation: false,
        genericDisease: false,
        industryMisalignment: false,
      },
      firstName,
    };
  } catch (error) {
    console.error("Error generating roast:", error);
    
    // Fallback roast if API fails
    return {
      content: config.fallbackContent(firstName),
      emojiScore: config.fallbackScore,
      scoreLabel: config.fallbackLabel,
      tagline: config.fallbackTagline,
      categories: {
        buzzwordBingo: true,
        lengthCrimes: false,
        formattingDisasters: false,
        skillsInflation: false,
        genericDisease: true,
        industryMisalignment: false,
      },
      firstName,
    };
  }
}

// Generate shareable preview text (no PII)
export function generateShareablePreview(roast: RoastResult): string {
  const previews = [
    `This resume scored ${roast.emojiScore} - "${roast.scoreLabel}"`,
    `Just got absolutely destroyed. Score: ${roast.emojiScore}`,
    `Resume verdict: ${roast.emojiScore} - "${roast.scoreLabel}"`,
    `AI rated this resume: ${roast.emojiScore}. It was brutal.`,
  ];
  
  return previews[Math.floor(Math.random() * previews.length)];
}