import { callOpenAI } from "@/lib/openai/client";
import { Models } from "@/lib/openai/models";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

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
    const raw = await callOpenAI({
      model: Models.default,
      systemPrompt: config.systemMessage,
      messages: [{ role: "user", content: config.prompt + resumeText }],
      temperature: 0.9,
      maxTokens: 1000,
      responseFormat: "json_object",
      tracking: { feature: "resume_roast" },
    });

    const response = JSON.parse(raw);
    
    // AI writes its own opening — no hardcoded wrapper
    let roastContent = response.roast ?? config.fallbackContent(firstName);

    // Add sign-off
    const signOffs = config.signOffs.length > 0 ? config.signOffs : [""];
    const signOff = signOffs[Math.floor(Math.random() * signOffs.length)];
    const emojiScore = response.emojiScore ?? config.fallbackScore;
    roastContent += signOff.replace('${emojiScore}', emojiScore);

    return {
      content: roastContent,
      emojiScore,
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
    loggerService.error("Error generating roast", error, {
      category: LogCategory.AI_SERVICE,
      action: "roast_generation_fallback",
    });
    
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