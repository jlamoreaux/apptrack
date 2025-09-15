import { Models } from "../replicate/models";

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
 * Always uses GPT-4o-mini for maximum cost efficiency
 */
export function getModelConfig(featureType: AIFeatureType) {
  // Optimize token limits based on task complexity
  const maxTokens = featureType === 'resume_analysis' || featureType === 'job_fit_analysis' 
    ? 1500  // More tokens for complex analysis
    : 1000; // Standard tokens for generation tasks
  
  return {
    model: Models.default, // Always GPT-4o-mini for cost efficiency
    maxTokens,
    temperature: 0.7,
  };
}

/**
 * Cost estimation per request (in USD) - always uses cheapest model
 */
export function estimateRequestCost(inputTokens: number, outputTokens: number): number {
  // Always use GPT-4o-mini pricing (most cost-effective)
  const pricing = { input: 0.15, output: 0.60 }; // GPT-4o-mini per 1M tokens
  
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
}