import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { unsubscribeContact } from '@/lib/email/audiences';
import { cancelPendingDrips } from '@/lib/email/drip-scheduler';
import { createAdminClient } from '@/lib/supabase/admin-client';
import { updateEmailPreferences, CATEGORY_COLUMN, type EmailCategory } from '@/lib/email/preferences';
import { EMAIL_THEME } from '@/lib/email/templates/shared';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  drip: 'tips and onboarding emails',
  reminders: 'application reminder emails',
  digest: 'the weekly pipeline digest',
};

function parseCategory(value: unknown): EmailCategory | null {
  return value === 'drip' || value === 'reminders' || value === 'digest' ? value : null;
}

/**
 * Disable a single email category for the user behind this address. Used by
 * per-category one-click links. Returns 'no_user' when the address has no
 * profile (e.g. a lead) so the caller can fall back to a global unsubscribe.
 */
async function unsubscribeCategory(
  email: string,
  category: EmailCategory
): Promise<'updated' | 'no_user' | 'error'> {
  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) return 'error';
  if (!profile?.id) return 'no_user';

  const result = await updateEmailPreferences(profile.id, { [CATEGORY_COLUMN[category]]: false });
  return result.success ? 'updated' : 'error';
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.apptrack.ing';
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'fallback-secret-change-me';

/**
 * Generate HMAC token for email unsubscribe
 * Uses a secret key to prevent forging unsubscribe links
 */
export function generateUnsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Verify the unsubscribe token using HMAC
 */
function verifyToken(email: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(email);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Handle email unsubscribe requests
 *
 * GET /api/email/unsubscribe?email=user@example.com&token=xyz
 * - Displays confirmation page
 *
 * POST /api/email/unsubscribe
 * - Actually unsubscribes the user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const rawCategory = searchParams.get('category');

  if (!email || !token) {
    return new NextResponse(getErrorPage('Missing email or token'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Reject unknown categories instead of silently treating the link as a
  // global unsubscribe.
  const category = parseCategory(rawCategory);
  if (rawCategory !== null && !category) {
    return new NextResponse(getErrorPage('Invalid unsubscribe link'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const decodedEmail = decodeURIComponent(email);

  if (!verifyToken(decodedEmail, token)) {
    return new NextResponse(getErrorPage('Invalid unsubscribe link'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Show confirmation page
  return new NextResponse(getConfirmationPage(decodedEmail, token, category), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, category } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Missing email or token' },
        { status: 400 }
      );
    }

    if (!verifyToken(email, token)) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe link' },
        { status: 400 }
      );
    }

    // Reject unknown categories instead of falling through to a global
    // unsubscribe the user didn't ask for.
    const parsedCategory = parseCategory(category);
    if (category !== undefined && category !== null && !parsedCategory) {
      return NextResponse.json({ error: 'Unknown email category' }, { status: 400 });
    }

    // Per-category opt-out: disable just one lifecycle category, leave the rest.
    if (parsedCategory) {
      const outcome = await unsubscribeCategory(email, parsedCategory);
      if (outcome === 'error') {
        return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
      }
      if (outcome === 'updated') {
        // Opting out of drips must also stop the already-scheduled ones — the
        // drip cron reads from drip_emails, not just the preference flag.
        if (parsedCategory === 'drip') {
          await cancelPendingDrips(email);
        }
        loggerService.info('User unsubscribed from email category', {
          category: LogCategory.BUSINESS,
          action: 'email_category_unsubscribe',
          metadata: { email, emailCategory: parsedCategory },
        });
        return NextResponse.json({ success: true, category: parsedCategory });
      }
      // 'no_user': no profile behind this address (e.g. a lead) — fall through
      // to the global unsubscribe so the valid token still opts them out.
    }

    // Unsubscribe the contact (all marketing email)
    const result = await unsubscribeContact(email);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to unsubscribe' },
        { status: 500 }
      );
    }

    // Cancel pending drip emails
    await cancelPendingDrips(email);

    loggerService.info('User unsubscribed from emails', {
      category: LogCategory.BUSINESS,
      action: 'email_unsubscribe',
      metadata: { email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Error processing unsubscribe', error, {
      category: LogCategory.API,
      action: 'unsubscribe_error',
    });

    return NextResponse.json(
      { error: 'Failed to process unsubscribe' },
      { status: 500 }
    );
  }
}

function getConfirmationPage(email: string, token: string, category: EmailCategory | null): string {
  // Escape user input to prevent XSS
  const safeEmail = escapeHtml(email);
  // JSON.stringify handles escaping for JS context
  const jsonEmail = JSON.stringify(email);
  const jsonToken = JSON.stringify(token);
  const jsonCategory = JSON.stringify(category);

  const confirmCopy = category
    ? `Are you sure you want to unsubscribe <span class="email">${safeEmail}</span> from ${CATEGORY_LABEL[category]}?`
    : `Are you sure you want to unsubscribe <span class="email">${safeEmail}</span> from AppTrack emails?`;
  const successCopy = category
    ? `You've been unsubscribed from ${CATEGORY_LABEL[category]}. Other AppTrack emails are unaffected.`
    : `You've been unsubscribed from AppTrack marketing emails. You'll still receive transactional emails about your account.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - AppTrack</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${EMAIL_THEME.pageBg};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: ${EMAIL_THEME.cardBg};
      border-radius: 8px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: ${EMAIL_THEME.heading};
      margin-bottom: 24px;
    }
    .brand img { vertical-align: -6px; margin-right: 8px; border-radius: 6px; }
    h1 { font-size: 24px; color: ${EMAIL_THEME.heading}; margin-bottom: 16px; }
    p { font-size: 16px; color: ${EMAIL_THEME.body}; margin-bottom: 24px; line-height: 1.5; }
    .email { font-weight: 600; color: ${EMAIL_THEME.heading}; }
    button {
      background: ${EMAIL_THEME.cta};
      color: ${EMAIL_THEME.ctaForeground};
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      min-height: 44px;
      margin-bottom: 12px;
    }
    button:hover { background: #ea580c; }
    button:disabled { background: #fdba74; cursor: not-allowed; }
    .cancel {
      background: transparent;
      color: ${EMAIL_THEME.muted};
      border: 1px solid ${EMAIL_THEME.border};
      font-weight: 400;
    }
    .cancel:hover { background: ${EMAIL_THEME.panelBg}; }
    .success { display: none; }
    .success h1 { color: #16a34a; }
    .error { color: #dc2626; display: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand"><img src="${APP_URL}/logo_square.png" alt="" width="24" height="24">AppTrack</div>
    <div id="confirm">
      <h1>Unsubscribe</h1>
      <p>${confirmCopy}</p>
      <button id="unsubscribeBtn" onclick="unsubscribe()">Unsubscribe</button>
      <button class="cancel" onclick="window.location.href='${APP_URL}'">Cancel</button>
      <p id="error" class="error"></p>
    </div>
    <div id="success" class="success">
      <h1>Unsubscribed</h1>
      <p>${successCopy}</p>
      <button onclick="window.location.href='${APP_URL}'">Go to AppTrack</button>
    </div>
  </div>
  <script>
    const EMAIL = ${jsonEmail};
    const TOKEN = ${jsonToken};
    const CATEGORY = ${jsonCategory};

    async function unsubscribe() {
      const btn = document.getElementById('unsubscribeBtn');
      const error = document.getElementById('error');
      btn.disabled = true;
      btn.textContent = 'Unsubscribing...';
      error.style.display = 'none';

      try {
        const response = await fetch('/api/email/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(CATEGORY ? { email: EMAIL, token: TOKEN, category: CATEGORY } : { email: EMAIL, token: TOKEN })
        });

        if (response.ok) {
          document.getElementById('confirm').style.display = 'none';
          document.getElementById('success').style.display = 'block';
        } else {
          const data = await response.json();
          error.textContent = data.error || 'Something went wrong. Please try again.';
          error.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Unsubscribe';
        }
      } catch (e) {
        error.textContent = 'Something went wrong. Please try again.';
        error.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Unsubscribe';
      }
    }
  </script>
</body>
</html>
`;
}

function getErrorPage(message: string): string {
  // Escape message to prevent XSS
  const safeMessage = escapeHtml(message);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - AppTrack</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${EMAIL_THEME.pageBg};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: ${EMAIL_THEME.cardBg};
      border-radius: 8px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
      color: ${EMAIL_THEME.heading};
      margin-bottom: 24px;
    }
    .brand img { vertical-align: -6px; margin-right: 8px; border-radius: 6px; }
    h1 { font-size: 24px; color: #dc2626; margin-bottom: 16px; }
    p { font-size: 16px; color: ${EMAIL_THEME.body}; margin-bottom: 24px; line-height: 1.5; }
    button {
      background: ${EMAIL_THEME.cta};
      color: ${EMAIL_THEME.ctaForeground};
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      min-height: 44px;
    }
    button:hover { background: #ea580c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand"><img src="${APP_URL}/logo_square.png" alt="" width="24" height="24">AppTrack</div>
    <h1>Error</h1>
    <p>${safeMessage}</p>
    <button onclick="window.location.href='${APP_URL}'">Go to AppTrack</button>
  </div>
</body>
</html>
`;
}
