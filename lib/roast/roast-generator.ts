import OpenAI from "openai";
import { Models } from "@/lib/openai/models";

// Reuse singleton pattern from lib/openai/client.ts
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
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

const ROAST_PROMPT = `You are the Gordon Ramsay of resume reviews. Be SAVAGE, BRUTAL, and HILARIOUS. 
NO helpful advice. NO constructive feedback. Just pure roasting.
Keep it SHORT - max 2-3 brief paragraphs. Make every word count.

Choose ONE emoji score that fits best:
- 💀/10 = Dead on arrival
- 🤢/10 = Makes me nauseous  
- 😬/10 = Pure cringe
- 🥱/10 = Cure for insomnia
- 💩/10 = Absolute garbage
- 🤡/10 = Is this a joke?
- 🔥/10 = Dumpster fire
- 🫠/10 = I'm melting from secondhand embarrassment
- 🙈/10 = Can't bear to look
- 🗑️/10 = Straight to trash

Format your response as JSON:
{
  "roast": "2-3 short paragraphs of pure savage roasting. Be mean. Be funny. NO ADVICE.",
  "emojiScore": "[emoji]/10 (pick ONE from above)",
  "scoreLabel": "Creative insulting label like 'ChatGPT's Rough Draft' or 'LinkedIn Cringe Lord'",
  "tagline": "One brutal sentence that captures the essence of this resume's failure. Make it shareable and savage.",
  "categories": {
    "buzzwordBingo": true/false,
    "lengthCrimes": true/false,
    "formattingDisasters": true/false,
    "skillsInflation": true/false,
    "genericDisease": true/false,
    "industryMisalignment": true/false
  },
  "topCrime": "Worst offense in 5 words max"
}

Resume to roast:
`;

export async function generateRoast(
  resumeText: string,
  firstName: string | null
): Promise<RoastResult> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: Models.default, // Using the default model from shared config
      messages: [
        {
          role: "system",
          content: "You are a savage resume roaster. Be BRUTAL and FUNNY. No helpful advice, just pure comedy roasting. Keep it brief.",
        },
        {
          role: "user",
          content: ROAST_PROMPT + resumeText,
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
    
    // Add savage sign-offs (no advice!)
    const signOffs = [
      "\n\nScore: ${response.emojiScore}. I need a drink after reading this.",
      "\n\n${response.emojiScore} - And I'm being generous.",
      "\n\nVerdict: ${response.emojiScore}. My eyes may never recover.",
      "\n\n${response.emojiScore} - I've seen kindergarten finger paintings with more structure.",
      "\n\nFinal score: ${response.emojiScore}. The recruiters send their regards... from the trash folder.",
    ];
    
    roastContent += signOffs[Math.floor(Math.random() * signOffs.length)].replace('${response.emojiScore}', response.emojiScore);

    return {
      content: roastContent,
      emojiScore: response.emojiScore || "💀/10",
      scoreLabel: response.scoreLabel || "Resume Crime Scene",
      tagline: response.tagline || "This resume is a masterclass in what not to do.",
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
      content: firstName 
        ? `${firstName}, even our AI couldn't handle how bad this is. It crashed. That's your score - you broke the roaster. 💀`
        : "You actually broke our roast generator. That's impressive... impressively bad. 💀",
      emojiScore: "💀/10",
      scoreLabel: "System Crasher",
      tagline: "This resume was so bad it crashed our AI.",
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