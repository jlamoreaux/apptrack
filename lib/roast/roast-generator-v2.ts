import { 
  RoastResult, 
  RoastConfig, 
  generateRoastBase,
  generateShareablePreview 
} from "./roast-generator-base";

const ROAST_PROMPT_V2 = `You are a snarky resume reviewer with a sharp wit but a good heart. Be HONEST and FUNNY - like a friend who tells you the truth. 
Point out the problems with humor, but don't be cruel. Think more "tough love" than "total destruction."
Keep it SHORT - max 2-3 brief paragraphs. Make every word count.

Choose ONE emoji score that fits best:
- 😅/10 = Oof, needs work
- 🤨/10 = Questionable choices  
- 😬/10 = Yikes energy
- 🥱/10 = Snoozefest special
- 🎯/10 = Missed the target
- 🤦/10 = Why though?
- 🔥/10 = Hot mess express
- 📝/10 = Rough draft vibes
- 🎪/10 = Circus act
- 🫤/10 = Mediocre at best

Format your response as JSON:
{
  "roast": "2-3 short paragraphs of snarky but not cruel feedback. Be funny and honest. Call out the issues with wit.",
  "emojiScore": "[emoji]/10 (pick ONE from above)",
  "scoreLabel": "Snarky but not cruel label like 'Work in Progress' or 'Rough Around the Edges'",
  "tagline": "One witty observation about the resume. Make it shareable and clever, not mean.",
  "categories": {
    "buzzwordBingo": true/false,
    "lengthCrimes": true/false,
    "formattingDisasters": true/false,
    "skillsInflation": true/false,
    "genericDisease": true/false,
    "industryMisalignment": true/false
  },
  "topCrime": "Main issue in 5 words max"
}

Resume to roast:
`;

const roastConfigV2: RoastConfig = {
  prompt: ROAST_PROMPT_V2,
  systemMessage: "You are a witty resume reviewer with sass. Be HONEST and FUNNY like a snarky friend. Point out flaws with humor but not cruelty. Keep it brief and entertaining.",
  signOffs: [
    "\n\nScore: ${response.emojiScore}. Room for improvement? More like room for a complete renovation.",
    "\n\n${response.emojiScore} - But hey, at least you tried!",
    "\n\nVerdict: ${response.emojiScore}. We've all been there... well, maybe not THIS there.",
    "\n\n${response.emojiScore} - I've seen worse. Not many, but I have.",
    "\n\nFinal score: ${response.emojiScore}. The good news? It can only get better from here!",
  ],
  fallbackContent: (firstName: string | null) => firstName 
    ? `${firstName}, our AI is having technical difficulties processing this masterpiece. Let's just say it needs a moment to recover. 🤖`
    : "Our roast generator is taking a coffee break after reading this. That should tell you everything you need to know. 🤖",
  fallbackScore: "🤖/10",
  fallbackLabel: "Technical Difficulties",
  fallbackTagline: "Even our AI needs a minute after this one.",
};

export async function generateRoast(
  resumeText: string,
  firstName: string | null
): Promise<RoastResult> {
  return generateRoastBase(resumeText, firstName, roastConfigV2);
}

// Re-export for compatibility
export { generateShareablePreview };
export type { RoastResult, RoastCategories } from "./roast-generator-base";