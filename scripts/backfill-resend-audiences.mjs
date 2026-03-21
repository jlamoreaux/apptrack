/**
 * Backfill Resend Audiences
 *
 * Syncs all audience_members rows (where resend_contact_id is null)
 * into the appropriate Resend audience, then updates the DB with the
 * returned contact ID.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... node scripts/backfill-resend-audiences.mjs
 *
 * Safe to re-run — only processes rows where resend_contact_id IS NULL.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Read audience IDs from env vars — no hardcoding so the script works across environments
const AUDIENCE_IDS = {
  'leads':       process.env.RESEND_AUDIENCE_LEADS,
  'free-users':  process.env.RESEND_AUDIENCE_USERS,
  'trial-users': process.env.RESEND_AUDIENCE_USERS, // shares with free-users
  'paid-users':  process.env.RESEND_AUDIENCE_PAID_USERS,
};

const missingEnvVars = [
  !SUPABASE_URL && 'SUPABASE_URL',
  !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  !RESEND_API_KEY && 'RESEND_API_KEY',
  !AUDIENCE_IDS['leads'] && 'RESEND_AUDIENCE_LEADS',
  !AUDIENCE_IDS['free-users'] && 'RESEND_AUDIENCE_USERS',
  !AUDIENCE_IDS['paid-users'] && 'RESEND_AUDIENCE_PAID_USERS',
].filter(Boolean);

if (missingEnvVars.length > 0) {
  console.error(`Missing required env vars: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} → ${res.status}: ${body}`);
  }
  // 204 No Content (PATCH with return=minimal) has no body
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }
  return res.json();
}

/**
 * Look up an existing Resend contact by email to recover their contact ID.
 * Used when a create returns 409 (already exists) but no ID in the response.
 */
async function getExistingResendContact(audienceId, email) {
  const res = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts?email=${encodeURIComponent(email)}`,
    { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.id || null;
}

async function createResendContact(audienceId, email, firstName) {
  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      firstName: firstName || undefined,
      unsubscribed: false,
    }),
  });

  // Safely parse JSON — rate-limited responses may have empty bodies
  let data = {};
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 100)}`);
  }

  if (res.status === 429) {
    throw new Error(`Rate limited — slow down`);
  }

  if (!res.ok) {
    // Already exists — try to recover the existing contact ID
    if (data.message?.includes('already exists') || res.status === 409) {
      // First check if the response body contains the ID
      const existingId = data.id || data.contact?.id || null;
      if (existingId) {
        return { alreadyExisted: true, id: existingId };
      }
      // Fall back to a lookup GET to retrieve the contact ID
      const lookedUpId = await getExistingResendContact(audienceId, email);
      return { alreadyExisted: true, id: lookedUpId };
    }
    throw new Error(`Resend ${res.status} for ${email}: ${JSON.stringify(data)}`);
  }

  return { alreadyExisted: false, id: data.id };
}

async function updateContactId(email, contactId) {
  await supabaseFetch(
    `/audience_members?email=eq.${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ resend_contact_id: contactId }),
    }
  );
}

async function main() {
  console.log('Fetching unsynced audience_members from Supabase...');

  // Only fetch rows where resend_contact_id is null — makes the script idempotent
  const rows = await supabaseFetch(
    '/audience_members?select=email,current_audience,first_name,subscribed&resend_contact_id=is.null&order=created_at.asc'
  );

  const toSync = rows.filter(r => r.subscribed !== false);
  console.log(`Found ${rows.length} unsynced rows, ${toSync.length} subscribed to sync.\n`);

  let synced = 0;
  let skippedUnknownAudience = 0;
  let skippedAlreadyExisted = 0;
  let failed = 0;

  for (const row of toSync) {
    const { email, current_audience, first_name } = row;
    const audienceId = AUDIENCE_IDS[current_audience];

    if (!audienceId) {
      console.warn(`  SKIP  ${email} — unknown audience: ${current_audience}`);
      skippedUnknownAudience++;
      continue;
    }

    try {
      const { id, alreadyExisted } = await createResendContact(audienceId, email, first_name);

      if (alreadyExisted) {
        if (id) {
          // We have the ID — update the DB so the row is fully synced
          await updateContactId(email, id);
          console.log(`  EXIST ${email} (${current_audience}) — recovered ID ${id}`);
        } else {
          console.log(`  EXIST ${email} (${current_audience}) — already in Resend, ID not recoverable`);
        }
        skippedAlreadyExisted++;
      } else {
        await updateContactId(email, id);
        console.log(`  ADDED ${email} (${current_audience}) → ${id}`);
        synced++;
      }
    } catch (err) {
      console.error(`  FAIL  ${email} — ${err.message}`);
      failed++;
    }

    // Resend rate limit: 5 contacts/sec — stay comfortably under
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone. Added: ${synced} | Already existed: ${skippedAlreadyExisted} | Unknown audience: ${skippedUnknownAudience} | Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
