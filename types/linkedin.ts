/**
 * LinkedIn Profile types
 */

export interface LinkedInProfile {
  id: string;
  user_id: string;
  application_id: string;
  profile_url: string;
  name?: string | null;
  title?: string | null;
  profile_photo_url?: string | null;
  headline?: string | null;
  company?: string | null;
  location?: string | null;
  created_at: string;
}

export interface CreateLinkedInProfileInput {
  user_id: string;
  application_id: string;
  profile_url: string;
  name?: string;
  title?: string;
  profile_photo_url?: string;
  headline?: string;
  company?: string;
  location?: string;
}

export interface UpdateLinkedInProfileInput {
  name?: string;
  title?: string;
  profile_photo_url?: string;
  headline?: string;
  company?: string;
  location?: string;
}