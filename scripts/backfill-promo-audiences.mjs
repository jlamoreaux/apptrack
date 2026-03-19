/**
 * Backfill: Move existing promo users to paid-users audience
 *
 * Finds all users with active promo subscriptions (trialing or
 * active+cancel_at_period_end) who are currently in free-users or
 * trial-users audience and moves them to paid-users.
 *
 * Usage:
 *   node scripts/backfill-promo-audiences.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const AUDIENCE_IDS = {
  users: process.env.RESEND_AUDIENCE_USERS,       // free + trial
  paid:  process.env.RESEND_AUDIENCE_PAID_USERS,  // paid
};

async function run() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Find active promo subscriptions (no Stripe ID = promo-activated)
  const { data: promoSubs, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, status, cancel_at_period_end, current_period_end')
    .is('stripe_subscription_id', null)
    .or('status.eq.trialing,and(status.eq.active,cancel_at_period_end.eq.true)')
    .gt('current_period_end', new Date().toISOString()); // still active

  if (error) {
    console.error('Failed to fetch promo subscriptions:', error);
    process.exit(1);
  }

  console.log(`Found ${promoSubs.length} active promo subscription(s)\n`);

  let moved = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of promoSubs) {
    // Look up their audience membership
    const { data: member } = await supabase
      .from('audience_members')
      .select('email, current_audience, resend_contact_id')
      .eq('user_id', sub.user_id)
      .single();

    if (!member) {
      console.log(`  SKIP  user_id=${sub.user_id} — not in audience_members`);
      skipped++;
      continue;
    }

    if (member.current_audience === 'paid-users') {
      console.log(`  SKIP  ${member.email} — already in paid-users`);
      skipped++;
      continue;
    }

    console.log(`  MOVE  ${member.email} | ${member.current_audience} → paid-users | status=${sub.status}`);

    if (DRY_RUN) {
      moved++;
      continue;
    }

    // 1. Cancel any pending drip emails from the old audience so they don't fire
    //    after we move the user. Mirrors what transitionAudience/cancelPendingDrips
    //    does internally.
    const { error: dripErr } = await supabase
      .from('drip_emails')
      .update({ status: 'cancelled' })
      .eq('email', member.email.toLowerCase().trim())
      .eq('audience', member.current_audience)
      .eq('status', 'pending');

    if (dripErr) {
      console.error(`  ERROR cancelling drip emails for ${member.email}:`, dripErr);
      // Non-fatal — log and continue; drip emails will just send to old audience
    }

    // 2. Remove from current audience in Resend
    if (member.resend_contact_id && AUDIENCE_IDS.users) {
      try {
        await resend.contacts.remove({
          audienceId: AUDIENCE_IDS.users,
          id: member.resend_contact_id,
        });
      } catch (e) {
        // May not exist in Resend — that's fine
      }
    }

    // 3. Add to paid-users in Resend, using only the fresh contact ID
    let newResendId = null; // do NOT reuse old ID from a different audience
    if (AUDIENCE_IDS.paid) {
      try {
        const { data, error: resendErr } = await resend.contacts.create({
          audienceId: AUDIENCE_IDS.paid,
          email: member.email,
          unsubscribed: false,
        });
        if (!resendErr && data?.id) {
          newResendId = data.id;
        } else {
          console.error(`  ERROR adding ${member.email} to Resend paid audience:`, resendErr);
          failed++;
          continue;
        }
      } catch (e) {
        console.error(`  ERROR adding ${member.email} to Resend paid audience:`, e);
        failed++;
        continue;
      }
    }

    // 4. Update audience_members table
    const { error: dbErr } = await supabase
      .from('audience_members')
      .update({
        current_audience: 'paid-users',
        resend_contact_id: newResendId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', sub.user_id);

    if (dbErr) {
      console.error(`  ERROR updating DB for ${member.email}:`, dbErr);
      failed++;
      continue;
    }

    moved++;
    await new Promise(r => setTimeout(r, 300)); // rate limit: ~3 req/sec
  }

  console.log(`\nDone. Moved: ${moved} | Skipped: ${skipped} | Failed: ${failed}`);
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
