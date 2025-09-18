import { Models } from "../openai/models";

/**
 * AI feature types for configuration
 */
export type AIFeatureType = 
  | 'resume_analysis'
  | 'job_fit_analysis' 
  | 'cover_letter'
  | 'interview_prep'
  | 'career_advice'
  | 'general';

/**
 * Get cost-optimized model configuration
 * Uses Claude Sonnet 4 as default for balance of performance and cost
 */
export function getModelConfig(featureType: AIFeatureType) {
  // Optimize token limits based on task complexity
  const maxTokens = featureType === 'resume_analysis' || featureType === 'job_fit_analysis' 
    ? 2000  // More tokens for complex analysis
    : 1500; // Standard tokens for generation tasks
  
  return {
    model: Models.default, // GPT-4o-mini - extremely cost-effective
    maxTokens,
    temperature: 0.7,
  };
}

/**
 * Cost estimation per request (in USD) - using GPT-4o-mini pricing
 */
export function estimateRequestCost(inputTokens: number, outputTokens: number): number {
  // GPT-4o-mini pricing (most cost-effective)
  const pricing = { input: 0.60, output: 2.40 }; // GPT-4o-mini per 1M tokens
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}