/**
 * Resend Audiences Integration
 *
 * Manages audience membership for email marketing:
 * - leads: Email capture before signup (resume roast, etc.)
 * - free-users: Signed up users on free plan
 * - trial-users: Users on trial
 * - paid-users: Paying customers
 */

import { resend } from './client';
import { createAdminClient } from '@/lib/supabase/admin-client';

// Internal audience types for drip logic (trial-users maps to 'users' in Resend)
export type AudienceId = 'leads' | 'free-users' | 'trial-users' | 'paid-users';

// Resend only has 3 audiences, trial-users shares with free-users
type ResendAudienceId = 'leads' | 'users' | 'paid-users';

/**
 * Get Resend audience ID from environment variables
 * Note: trial-users maps to the same Resend audience as free-users
 */
function getAudienceId(audienceId: AudienceId): string | null {
  // Map internal audience to Resend audience
  const resendAudienceMap: Record<AudienceId, ResendAudienceId> = {
    'leads': 'leads',
    'free-users': 'users',
    'trial-users': 'users', // Trial users share the same Resend audience
    'paid-users': 'paid-users',
  };

  const envMap: Record<ResendAudienceId, string | undefined> = {
    'leads': process.env.RESEND_AUDIENCE_LEADS,
    'users': process.env.RESEND_AUDIENCE_USERS,
    'paid-users': process.env.RESEND_AUDIENCE_PAID_USERS,
  };

  const resendAudience = resendAudienceMap[audienceId];
  const id = envMap[resendAudience];

  if (!id) {
    console.warn(`[audiences] Missing env var for audience: ${resendAudience}`);
    return null;
  }

  return id;
}

export type AddToAudienceOptions = {
  email: string;
  audienceId: AudienceId;
  firstName?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Add a contact to an audience
 * - Adds to Resend audience
 * - Stores in local audience_members table
 */
export async function addToAudience({
  email,
  audienceId,
  firstName,
  userId,
  metadata = {},
}: AddToAudienceOptions): Promise<{ success: boolean; contactId?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Add to Resend audience
  let resendContactId: string | null = null;
  const resendAudienceId = getAudienceId(audienceId);

  if (resendAudienceId && resend) {
    try {
      const { data, error } = await resend.contacts.create({
        audienceId: resendAudienceId,
        email: normalizedEmail,
        firstName: firstName || undefined,
        unsubscribed: false,
      });

      if (error) {
        // Contact might already exist, which is fine
        if (!error.message?.includes('already exists')) {
          console.error('[audiences] Failed to add contact to Resend:', error);
        }
      } else {
        resendContactId = data?.id || null;
      }
    } catch (error) {
      console.error('[audiences] Error adding to Resend audience:', error);
    }
  }

  // Upsert to local database
  const { error: dbError } = await supabase
    .from('audience_members')
    .upsert(
      {
        email: normalizedEmail,
        user_id: userId || null,
        current_audience: audienceId,
        resend_contact_id: resendContactId,
        first_name: firstName || null,
        metadata,
        subscribed: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'email',
      }
    );

  if (dbError) {
    console.error('[audiences] Failed to upsert audience member:', dbError);
    return { success: false };
  }

  return { success: true, contactId: resendContactId || undefined };
}

/**
 * Remove a contact from an audience
 */
export async function removeFromAudience(
  email: string,
  audienceId: AudienceId
): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Get the contact's Resend ID from our database
  const { data: member } = await supabase
    .from('audience_members')
    .select('resend_contact_id')
    .eq('email', normalizedEmail)
    .single();

  // Remove from Resend if we have the contact ID
  if (member?.resend_contact_id && resend) {
    const resendAudienceId = getAudienceId(audienceId);
    if (resendAudienceId) {
      try {
        await resend.contacts.remove({
          audienceId: resendAudienceId,
          id: member.resend_contact_id,
        });
      } catch (error) {
        console.error('[audiences] Error removing from Resend audience:', error);
      }
    }
  }

  return { success: true };
}

/**
 * Transition a contact from one audience to another
 * - Removes from old audience in Resend
 * - Adds to new audience in Resend
 * - Updates local database
 */
export async function transitionAudience(
  email: string,
  fromAudience: AudienceId,
  toAudience: AudienceId,
  options?: {
    firstName?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Get existing member data
  const { data: existingMember } = await supabase
    .from('audience_members')
    .select('*')
    .eq('email', normalizedEmail)
    .single();

  // Remove from old Resend audience
  if (existingMember?.resend_contact_id && resend) {
    const oldResendAudienceId = getAudienceId(fromAudience);
    if (oldResendAudienceId) {
      try {
        await resend.contacts.remove({
          audienceId: oldResendAudienceId,
          id: existingMember.resend_contact_id,
        });
      } catch (error) {
        // Contact might not exist in old audience, which is fine
        console.warn('[audiences] Could not remove from old audience:', error);
      }
    }
  }

  // Add to new audience
  const result = await addToAudience({
    email: normalizedEmail,
    audienceId: toAudience,
    firstName: options?.firstName || existingMember?.first_name || undefined,
    userId: options?.userId || existingMember?.user_id || undefined,
    metadata: {
      ...existingMember?.metadata,
      ...options?.metadata,
      previousAudience: fromAudience,
      transitionedAt: new Date().toISOString(),
    },
  });

  return result;
}

/**
 * Get a contact's current audience
 */
export async function getAudienceMember(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('audience_members')
    .select('*')
    .eq('email', normalizedEmail)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('[audiences] Error getting audience member:', error);
  }

  return data;
}

/**
 * Mark a contact as unsubscribed
 */
export async function unsubscribeContact(email: string): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Get current audience membership
  const { data: member } = await supabase
    .from('audience_members')
    .select('current_audience, resend_contact_id')
    .eq('email', normalizedEmail)
    .single();

  // Update Resend contact to unsubscribed
  if (member?.resend_contact_id && resend) {
    const resendAudienceId = getAudienceId(member.current_audience as AudienceId);
    if (resendAudienceId) {
      try {
        await resend.contacts.update({
          audienceId: resendAudienceId,
          id: member.resend_contact_id,
          unsubscribed: true,
        });
      } catch (error) {
        console.error('[audiences] Error unsubscribing in Resend:', error);
      }
    }
  }

  // Update local database
  const { error } = await supabase
    .from('audience_members')
    .update({
      subscribed: false,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail);

  if (error) {
    console.error('[audiences] Error unsubscribing contact:', error);
    return { success: false };
  }

  return { success: true };
}

/**
 * Check if a contact is subscribed
 */
export async function isSubscribed(email: string): Promise<boolean> {
  const member = await getAudienceMember(email);
  return member?.subscribed ?? false;
}

/**
 * Link a user ID to an existing audience member (e.g., when a lead signs up)
 */
export async function linkUserToAudienceMember(
  email: string,
  userId: string
): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('audience_members')
    .update({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail);

  if (error) {
    console.error('[audiences] Error linking user to audience member:', error);
    return { success: false };
  }

  return { success: true };
}
