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
 * Safe to re-run — skips rows that already have a resend_contact_id.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const AUDIENCE_IDS = {
  'leads':       '00c20980-13e9-4f82-8b54-dda6d52d66e8',
  'free-users':  '1d504715-561e-47e1-a688-f22742ae9ef3',
  'trial-users': '1d504715-561e-47e1-a688-f22742ae9ef3', // shares with free-users
  'paid-users':  '966996e2-80f1-48cd-8c7f-852dad98a5f8',
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY');
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
    // Already exists is fine — Resend returns 409 or an error message
    if (data.message?.includes('already exists') || res.status === 409) {
      return { alreadyExisted: true, id: null };
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
  console.log('Fetching audience_members from Supabase...');

  const rows = await supabaseFetch(
    '/audience_members?select=email,current_audience,first_name,subscribed&order=created_at.asc'
  );

  const toSync = rows.filter(r => r.subscribed !== false);
  console.log(`Found ${rows.length} total rows, ${toSync.length} subscribed to sync.\n`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of toSync) {
    const { email, current_audience, first_name } = row;
    const audienceId = AUDIENCE_IDS[current_audience];

    if (!audienceId) {
      console.warn(`  SKIP  ${email} — unknown audience: ${current_audience}`);
      skipped++;
      continue;
    }

    try {
      const { id, alreadyExisted } = await createResendContact(audienceId, email, first_name);

      if (alreadyExisted) {
        console.log(`  EXIST ${email} (${current_audience}) — already in Resend`);
        skipped++;
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

  console.log(`\nDone. Added: ${synced} | Already existed: ${skipped} | Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
