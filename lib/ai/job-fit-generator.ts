import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface JobFitAnalysis {
  fitScore: number; // 0-100
  strengths: string[]; // 3-5 specific strengths
  gaps: string[]; // 2-4 areas where candidate is missing requirements
  redFlags: string[]; // 0-2 potential deal-breakers
  recommendation: string; // Clear yes/no/maybe with reasoning
  nextSteps: string[]; // 3-4 actionable recommendations
}

export interface JobFitInput {
  jobDescription: string;
  userBackground: string;
  targetRole?: string;
}

/**
 * Generate a job fit analysis using Claude AI
 * Analyzes how well a candidate's background matches a job posting
 */
export async function generateJobFitAnalysis(
  input: JobFitInput
): Promise<JobFitAnalysis> {
  const prompt = `You are an expert career coach and recruiter. Analyze how well this candidate fits the job posting.

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE BACKGROUND:
${input.userBackground}

${input.targetRole ? `TARGET ROLE: ${input.targetRole}` : ''}

Provide a detailed fit analysis in JSON format with the following structure:

{
  "fitScore": 0-100 (number),
  "strengths": [
    "Specific strength 1 where candidate matches well",
    "Specific strength 2 where candidate matches well",
    "Specific strength 3 where candidate matches well"
  ],
  "gaps": [
    "Specific gap 1 where candidate is missing requirements",
    "Specific gap 2 where candidate is missing requirements"
  ],
  "redFlags": [
    "Critical issue 1 if any",
    "Critical issue 2 if any"
  ],
  "recommendation": "Clear yes/no/maybe recommendation with 2-3 sentence reasoning",
  "nextSteps": [
    "Actionable next step 1",
    "Actionable next step 2",
    "Actionable next step 3"
  ]
}

Guidelines for the analysis:
1. Be specific and reference actual requirements from the job description
2. Focus on skills, experience, and qualifications that matter
3. Be honest but constructive about gaps
4. Only include redFlags if there are serious mismatches (not just minor gaps)
5. Make nextSteps actionable and realistic
6. Base fitScore on: skills match (40%), experience level (30%), domain knowledge (20%), culture fit signals (10%)

Respond ONLY with valid JSON, no other text.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse JSON response
    const analysis: JobFitAnalysis = JSON.parse(content.text);

    // Validate the response structure
    if (
      typeof analysis.fitScore !== "number" ||
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.gaps) ||
      !Array.isArray(analysis.redFlags) ||
      typeof analysis.recommendation !== "string" ||
      !Array.isArray(analysis.nextSteps)
    ) {
      throw new Error("Invalid response structure from Claude");
    }

    // Ensure fitScore is within bounds
    analysis.fitScore = Math.max(0, Math.min(100, analysis.fitScore));

    return analysis;
  } catch (error) {
    console.error("Job fit analysis generation error:", error);

    // If parsing fails, provide a fallback error response
    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse AI response. Please try again.");
    }

    throw error;
  }
}

/**
 * Create a preview version of the analysis (for pre-signup display)
 * Shows partial information to encourage signup
 */
export function createPreviewAnalysis(
  fullAnalysis: JobFitAnalysis
): Partial<JobFitAnalysis> {
  return {
    fitScore: fullAnalysis.fitScore,
    strengths: fullAnalysis.strengths.slice(0, 2), // Show first 2 strengths
    gaps: [], // Hide gaps in preview
    redFlags: [], // Hide red flags in preview
    recommendation: fullAnalysis.recommendation.split('.')[0] + '...', // Truncate recommendation
    nextSteps: [], // Hide next steps in preview
  };
}
