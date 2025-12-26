import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { unsubscribeContact } from '@/lib/email/audiences';
import { cancelPendingDrips } from '@/lib/email/drip-scheduler';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://apptrack.ing';
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

  if (!email || !token) {
    return new NextResponse(getErrorPage('Missing email or token'), {
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
  return new NextResponse(getConfirmationPage(decodedEmail, token), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

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

    // Unsubscribe the contact
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

function getConfirmationPage(email: string, token: string): string {
  // Escape user input to prevent XSS
  const safeEmail = escapeHtml(email);
  // JSON.stringify handles escaping for JS context
  const jsonEmail = JSON.stringify(email);
  const jsonToken = JSON.stringify(token);

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
      background-color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { font-size: 24px; color: #18181b; margin-bottom: 16px; }
    p { font-size: 16px; color: #3f3f46; margin-bottom: 24px; line-height: 1.5; }
    .email { font-weight: 600; color: #18181b; }
    button {
      background: #18181b;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 12px;
    }
    button:hover { background: #27272a; }
    button:disabled { background: #a1a1aa; cursor: not-allowed; }
    .cancel {
      background: transparent;
      color: #71717a;
      border: 1px solid #e4e4e7;
    }
    .cancel:hover { background: #f4f4f5; }
    .success { display: none; }
    .success h1 { color: #16a34a; }
    .error { color: #dc2626; display: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div id="confirm">
      <h1>Unsubscribe</h1>
      <p>Are you sure you want to unsubscribe <span class="email">${safeEmail}</span> from AppTrack emails?</p>
      <button id="unsubscribeBtn" onclick="unsubscribe()">Unsubscribe</button>
      <button class="cancel" onclick="window.location.href='${APP_URL}'">Cancel</button>
      <p id="error" class="error"></p>
    </div>
    <div id="success" class="success">
      <h1>Unsubscribed</h1>
      <p>You've been unsubscribed from AppTrack marketing emails. You'll still receive transactional emails about your account.</p>
      <button onclick="window.location.href='${APP_URL}'">Go to AppTrack</button>
    </div>
  </div>
  <script>
    const EMAIL = ${jsonEmail};
    const TOKEN = ${jsonToken};

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
          body: JSON.stringify({ email: EMAIL, token: TOKEN })
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
      background-color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { font-size: 24px; color: #dc2626; margin-bottom: 16px; }
    p { font-size: 16px; color: #3f3f46; margin-bottom: 24px; line-height: 1.5; }
    button {
      background: #18181b;
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    button:hover { background: #27272a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error</h1>
    <p>${safeMessage}</p>
    <button onclick="window.location.href='${APP_URL}'">Go to AppTrack</button>
  </div>
</body>
</html>
`;
}
