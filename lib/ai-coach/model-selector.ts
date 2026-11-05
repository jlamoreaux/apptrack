import { Models, calculateCost } from "../openai/models";

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
 */
export function getModelConfig(featureType: AIFeatureType) {
  // Optimize token limits based on task complexity
  const maxTokens = featureType === 'resume_analysis' || featureType === 'job_fit_analysis' 
    ? 2000  // More tokens for complex analysis
    : 1500; // Standard tokens for generation tasks
  
  return {
    model: Models.default,
    maxTokens,
    temperature: 0.7,
  };
}

/**
 * Cost estimation per request (in USD) for the default model
 */
export function estimateRequestCost(inputTokens: number, outputTokens: number): number {
  return calculateCost(Models.default, { inputTokens, outputTokens }).totalCostUsd;
}
