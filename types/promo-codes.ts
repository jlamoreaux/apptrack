/**
 * Type definitions for promotional codes and trial offers
 */

export type PromoCodeType = "trial" | "discount" | "free_forever" | "premium_free";

export type DiscountDuration = "once" | "forever" | "repeating";

/**
 * Database model for promotional codes
 */
export interface PromoCode {
  id: string;
  code: string;
  description: string;
  code_type: PromoCodeType;
  
  // Trial-specific fields
  trial_days?: number;
  plan_name?: string;
  
  // Discount-specific fields
  discount_percent?: number;
  discount_amount?: number;
  discount_duration?: DiscountDuration;
  discount_duration_months?: number;
  
  // Stripe integration
  stripe_coupon_id?: string;
  stripe_promotion_code_id?: string;
  stripe_promo_code_id?: string; // Legacy field
  
  // Usage constraints
  applicable_plans?: string[];
  max_uses?: number | null;
  used_count: number;
  
  // Status and dates
  active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  created_at: string;
  updated_at: string;
  
  // Display properties
  offerMessage?: string;
}

/**
 * Traffic source tracking
 */
export type TrafficSource = "reddit" | "linkedin" | "twitter" | "facebook" | "google" | "other";

/**
 * Trial offer for traffic sources
 */
export interface TrafficSourceTrial {
  days: number;
  type: "ai_coach_trial" | "pro_trial" | "custom_trial";
  source: TrafficSource;
  appliedAt?: string;
}

/**
 * Welcome offer (special promo for new users)
 */
export interface WelcomeOffer extends Pick<PromoCode, 
  | 'id' 
  | 'code' 
  | 'discount_percent' 
  | 'discount_amount'
  | 'discount_duration'
  | 'discount_duration_months'
  | 'stripe_coupon_id'
  | 'stripe_promotion_code_id'
  | 'applicable_plans'
  | 'offerMessage'
> {
  isWelcomeOffer: true;
}

/**
 * Form data for creating/updating promo codes
 */
export interface PromoCodeFormData {
  code: string;
  description: string;
  code_type: PromoCodeType;
  trial_days: number;
  plan_name: string;
  applicable_plans: string[];
  discount_percent?: number;
  discount_amount?: number;
  discount_duration?: DiscountDuration;
  discount_duration_months?: number;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  stripe_coupon_id?: string;
  stripe_promotion_code_id?: string;
  offerMessage?: string;
}

/**
 * API response for promo code operations
 */
export interface PromoCodeResponse {
  promoCode: PromoCode;
  error?: string;
}

/**
 * Promo code validation result
 */
export interface PromoCodeValidation {
  isValid: boolean;
  error?: string;
  promoCode?: PromoCode;
  canBypassCheckout?: boolean;
}

/**
 * User metadata for tracking applied promos and trials
 */
export interface UserPromoMetadata {
  traffic_source?: TrafficSource;
  traffic_source_trial?: TrafficSourceTrial;
  applied_promo_code?: string;
  trial_start_date?: string;
  trial_end_date?: string;
}

/**
 * Session storage for traffic tracking
 */
export interface TrafficSessionData {
  source: TrafficSource;
  trial?: TrafficSourceTrial;
  timestamp: string;
}

/**
 * Type guards with comprehensive validation
 */
export function isPromoCode(obj: any): obj is PromoCode {
  if (!obj || typeof obj !== 'object') return false;
  
  // Required fields
  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.code !== 'string' || !obj.code) return false;
  if (!['trial', 'discount', 'free_forever', 'premium_free'].includes(obj.code_type)) return false;
  if (typeof obj.used_count !== 'number') return false;
  if (typeof obj.active !== 'boolean') return false;
  if (typeof obj.created_at !== 'string') return false;
  if (typeof obj.updated_at !== 'string') return false;
  
  // Optional fields - validate type if present
  if (obj.trial_days !== undefined && typeof obj.trial_days !== 'number') return false;
  if (obj.plan_name !== undefined && typeof obj.plan_name !== 'string') return false;
  if (obj.discount_percent !== undefined && typeof obj.discount_percent !== 'number') return false;
  if (obj.discount_amount !== undefined && typeof obj.discount_amount !== 'number') return false;
  if (obj.discount_duration !== undefined && !['once', 'forever', 'repeating'].includes(obj.discount_duration)) return false;
  if (obj.discount_duration_months !== undefined && typeof obj.discount_duration_months !== 'number') return false;
  if (obj.applicable_plans !== undefined && !Array.isArray(obj.applicable_plans)) return false;
  if (obj.max_uses !== undefined && obj.max_uses !== null && typeof obj.max_uses !== 'number') return false;
  
  return true;
}

export function isTrafficSourceTrial(obj: any): obj is TrafficSourceTrial {
  if (!obj || typeof obj !== 'object') return false;
  
  if (typeof obj.days !== 'number' || obj.days <= 0) return false;
  if (typeof obj.type !== 'string' || !['ai_coach_trial', 'pro_trial', 'custom_trial'].includes(obj.type)) return false;
  if (typeof obj.source !== 'string' || !['reddit', 'linkedin', 'twitter', 'facebook', 'google', 'other'].includes(obj.source)) return false;
  
  return true;
}

export function isWelcomeOffer(obj: any): obj is WelcomeOffer {
  if (!obj || typeof obj !== 'object') return false;
  
  if (obj.isWelcomeOffer !== true) return false;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.code !== 'string' || !obj.code) return false;
  
  // Validate optional discount fields if present
  if (obj.discount_percent !== undefined && typeof obj.discount_percent !== 'number') return false;
  if (obj.discount_amount !== undefined && typeof obj.discount_amount !== 'number') return false;
  
  return true;
}

/**
 * Utility functions
 */
export function canBypassCheckout(promoCode: PromoCode): boolean {
  return promoCode.code_type === 'premium_free' || promoCode.code_type === 'free_forever';
}

export function getPromoDisplayMessage(promoCode: PromoCode): string {
  if (promoCode.offerMessage) {
    return promoCode.offerMessage;
  }
  
  switch (promoCode.code_type) {
    case 'trial':
      return `${promoCode.trial_days}-day free trial`;
    case 'discount':
      if (promoCode.discount_percent) {
        return `${promoCode.discount_percent}% off`;
      }
      if (promoCode.discount_amount) {
        return `$${promoCode.discount_amount} off`;
      }
      return 'Special discount';
    case 'free_forever':
      return 'Free forever';
    case 'premium_free':
      return 'Premium features - free';
    default:
      return 'Special offer';
  }
}

export function getTrialEndDate(startDate: Date, days: number): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate;
}