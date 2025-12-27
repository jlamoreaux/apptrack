import { 
  RoastResult, 
  RoastConfig, 
  generateRoastBase,
  generateShareablePreview 
} from "./roast-generator-base";

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

const roastConfig: RoastConfig = {
  prompt: ROAST_PROMPT,
  systemMessage: "You are a savage resume roaster. Be BRUTAL and FUNNY. No helpful advice, just pure comedy roasting. Keep it brief.",
  signOffs: [
    "\n\nScore: ${response.emojiScore}. I need a drink after reading this.",
    "\n\n${response.emojiScore} - And I'm being generous.",
    "\n\nVerdict: ${response.emojiScore}. My eyes may never recover.",
    "\n\n${response.emojiScore} - I've seen kindergarten finger paintings with more structure.",
    "\n\nFinal score: ${response.emojiScore}. The recruiters send their regards... from the trash folder.",
  ],
  fallbackContent: (firstName: string | null) => firstName 
    ? `${firstName}, even our AI couldn't handle how bad this is. It crashed. That's your score - you broke the roaster. 💀`
    : "You actually broke our roast generator. That's impressive... impressively bad. 💀",
  fallbackScore: "💀/10",
  fallbackLabel: "System Crasher",
  fallbackTagline: "This resume was so bad it crashed our AI.",
};

export async function generateRoast(
  resumeText: string,
  firstName: string | null
): Promise<RoastResult> {
  return generateRoastBase(resumeText, firstName, roastConfig);
}

// Re-export for compatibility
export { generateShareablePreview };
export type { RoastResult, RoastCategories } from "./roast-generator-base";