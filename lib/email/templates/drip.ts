/**
 * Drip Email Templates
 *
 * Templates are organized by audience and scheduled day:
 * - leads: Day 0, 2, 5 (nurture to signup)
 * - free-users: Day 0, 2, 5, 7 (onboard and activate)
 * - trial-users: Day 0, 3 (maximize trial value)
 * - paid-users: Day 0, 3 (onboard paid features)
 */

import type { AudienceId } from '../audiences';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://apptrack.ing';

export type DripTemplate = {
  templateId: string;
  subject: string;
  preheader: string;
  dayOffset: number; // Days after joining audience
  getHtml: (params: TemplateParams) => string;
};

export type TemplateParams = {
  firstName?: string;
  email: string;
  unsubscribeUrl: string;
  roastUrl?: string; // For leads from resume roast
};

// Common email wrapper
function wrapEmail(content: string, params: TemplateParams): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AppTrack</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">AppTrack</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #71717a; text-align: center;">
                You're receiving this because you signed up for AppTrack updates.
              </p>
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                <a href="${params.unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// CTA button component
function ctaButton(text: string, url: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="center">
      <a href="${url}" style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-weight: 500; border-radius: 6px;">${text}</a>
    </td>
  </tr>
</table>`;
}

// ============================================
// LEADS TEMPLATES (nurture to signup)
// ============================================

const leadsTemplates: DripTemplate[] = [
  {
    templateId: 'lead_day_0',
    subject: 'Your Resume Roast is Ready',
    preheader: 'See what our AI found in your resume',
    dayOffset: 0,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Thanks for using Resume Roast! Your personalized feedback is ready.
      </p>
      ${params.roastUrl ? ctaButton('View Your Roast', params.roastUrl) : ''}
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Want to take your job search to the next level? AppTrack helps you:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #3f3f46;">
        <li style="margin-bottom: 8px;">Track applications in one place</li>
        <li style="margin-bottom: 8px;">Get AI-powered interview prep</li>
        <li style="margin-bottom: 8px;">Analyze job fit before applying</li>
      </ul>
      ${ctaButton('Try AppTrack Free', `${APP_URL}/signup`)}
    `, params),
  },
  {
    templateId: 'lead_day_2',
    subject: '3 Tips to Improve Your Job Search',
    preheader: 'Based on thousands of successful applications',
    dayOffset: 2,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Here are 3 things that successful job seekers do differently:
      </p>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #18181b; font-weight: 600;">1. Track everything</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Keep notes on every application, interview, and follow-up. You'll spot patterns and never miss a deadline.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #18181b; font-weight: 600;">2. Customize every application</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Tailor your resume and cover letter to each job. Generic applications rarely get callbacks.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #18181b; font-weight: 600;">3. Prepare before interviews</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Research the company and practice answering common questions. Confidence comes from preparation.</p>
      </div>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        AppTrack helps you do all three, automatically.
      </p>
      ${ctaButton('Get Started Free', `${APP_URL}/signup`)}
    `, params),
  },
  {
    templateId: 'lead_day_5',
    subject: 'See How AppTrack Can Help',
    preheader: 'Your personal job search assistant',
    dayOffset: 5,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Still searching for your next role? Here's how AppTrack makes it easier:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #18181b; font-weight: 600;">AI Resume Analysis</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Get detailed feedback on how to improve</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #18181b; font-weight: 600;">Job Fit Analysis</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">See how well you match before applying</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #18181b; font-weight: 600;">Interview Prep</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Practice with AI-generated questions</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0;">
            <p style="margin: 0; font-size: 14px; color: #18181b; font-weight: 600;">Application Tracking</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">Never lose track of where you applied</p>
          </td>
        </tr>
      </table>
      ${ctaButton('Start Your Free Account', `${APP_URL}/signup`)}
    `, params),
  },
];

// ============================================
// FREE USERS TEMPLATES (onboard and activate)
// ============================================

const freeUsersTemplates: DripTemplate[] = [
  {
    templateId: 'free_day_0',
    subject: 'Welcome to AppTrack',
    preheader: 'Your job search just got easier',
    dayOffset: 0,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Welcome, ${params.firstName}!` : 'Welcome!'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Thanks for signing up for AppTrack. We're here to help you land your next role.
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Here's how to get started:
      </p>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">Step 1: Upload your resume</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Our AI will analyze it and give you personalized insights.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">Step 2: Add your first job application</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Track applications, interviews, and offers in one place.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">Step 3: Try the AI features</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Get job fit analysis, interview prep, and more.</p>
      </div>
      ${ctaButton('Go to Dashboard', `${APP_URL}/dashboard`)}
    `, params),
  },
  {
    templateId: 'free_day_2',
    subject: 'Try Your First AI Feature',
    preheader: 'Get personalized insights in seconds',
    dayOffset: 2,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Have you tried our AI features yet? Here's a quick one to start with:
      </p>
      <div style="margin: 0 0 24px; padding: 20px; background-color: #fafafa; border-radius: 6px; border-left: 4px solid #18181b;">
        <p style="margin: 0 0 8px; font-size: 16px; color: #18181b; font-weight: 600;">Job Fit Analysis</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">
          Paste a job description and see how well you match. Get specific suggestions on what to highlight in your application.
        </p>
      </div>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        It takes less than a minute and could make the difference in your next application.
      </p>
      ${ctaButton('Try Job Fit Analysis', `${APP_URL}/try/job-fit`)}
    `, params),
  },
  {
    templateId: 'free_day_5',
    subject: 'Add Your Resume for Personalized Insights',
    preheader: 'Unlock the full power of AppTrack',
    dayOffset: 5,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Quick tip: uploading your resume unlocks personalized insights across all our AI features.
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        With your resume on file, you can:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #3f3f46;">
        <li style="margin-bottom: 8px;">Get tailored job match scores</li>
        <li style="margin-bottom: 8px;">See which skills to highlight for each role</li>
        <li style="margin-bottom: 8px;">Generate cover letters based on your experience</li>
        <li style="margin-bottom: 8px;">Practice interview questions specific to your background</li>
      </ul>
      ${ctaButton('Upload Your Resume', `${APP_URL}/dashboard/resume`)}
    `, params),
  },
  {
    templateId: 'free_day_7',
    subject: "How's Your Job Search Going?",
    preheader: 'We want to help you succeed',
    dayOffset: 7,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        You've been using AppTrack for a week now. How's the job search going?
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        If you're finding the AI features helpful, you might want to check out our Pro plan for unlimited access to:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #3f3f46;">
        <li style="margin-bottom: 8px;">Unlimited AI analyses</li>
        <li style="margin-bottom: 8px;">Priority support</li>
        <li style="margin-bottom: 8px;">Advanced interview prep</li>
        <li style="margin-bottom: 8px;">Custom cover letters</li>
      </ul>
      ${ctaButton('See Pro Features', `${APP_URL}/dashboard/upgrade`)}
      <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
        Reply to this email if you have any questions. We're here to help!
      </p>
    `, params),
  },
];

// ============================================
// TRIAL USERS TEMPLATES (maximize trial value)
// ============================================

const trialUsersTemplates: DripTemplate[] = [
  {
    templateId: 'trial_day_0',
    subject: 'Your Trial is Active - Here\'s What to Try First',
    preheader: 'Make the most of your trial period',
    dayOffset: 0,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Your trial is now active! Here are the top features to try:
      </p>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">1. AI Resume Analysis</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Get detailed feedback on formatting, content, and impact.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">2. Interview Preparation</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Practice with AI-generated questions tailored to each role.</p>
      </div>
      <div style="margin: 0 0 16px; padding: 16px; background-color: #fafafa; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #18181b; font-weight: 600;">3. Cover Letter Generator</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">Create customized cover letters for each application.</p>
      </div>
      ${ctaButton('Start Exploring', `${APP_URL}/dashboard`)}
    `, params),
  },
  {
    templateId: 'trial_day_3',
    subject: 'Have You Tried Interview Prep Yet?',
    preheader: 'Our most popular feature',
    dayOffset: 3,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Interview Prep is one of our most-used features. Here's how it works:
      </p>
      <ol style="margin: 0 0 16px; padding-left: 20px; color: #3f3f46;">
        <li style="margin-bottom: 8px;">Paste the job description</li>
        <li style="margin-bottom: 8px;">Get 10+ tailored interview questions</li>
        <li style="margin-bottom: 8px;">See sample answers based on your resume</li>
        <li style="margin-bottom: 8px;">Practice until you feel confident</li>
      </ol>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Users who practice with Interview Prep report feeling significantly more confident in their interviews.
      </p>
      ${ctaButton('Try Interview Prep', `${APP_URL}/try/interview-prep`)}
    `, params),
  },
];

// ============================================
// PAID USERS TEMPLATES (onboard paid features)
// ============================================

const paidUsersTemplates: DripTemplate[] = [
  {
    templateId: 'paid_day_0',
    subject: 'Welcome to AppTrack Pro',
    preheader: 'Thank you for upgrading',
    dayOffset: 0,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Thank you for upgrading to AppTrack Pro! You now have unlimited access to all our AI features.
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Here's what's included in your Pro subscription:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #3f3f46;">
        <li style="margin-bottom: 8px;">Unlimited AI resume analyses</li>
        <li style="margin-bottom: 8px;">Unlimited job fit analyses</li>
        <li style="margin-bottom: 8px;">Unlimited interview prep sessions</li>
        <li style="margin-bottom: 8px;">Unlimited cover letter generation</li>
        <li style="margin-bottom: 8px;">Priority support</li>
      </ul>
      ${ctaButton('Go to Dashboard', `${APP_URL}/dashboard`)}
      <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; text-align: center;">
        Have questions? Reply to this email anytime.
      </p>
    `, params),
  },
  {
    templateId: 'paid_day_3',
    subject: 'Pro Tip: Get the Most from AI Coach',
    preheader: 'Maximize your subscription value',
    dayOffset: 3,
    getHtml: (params) => wrapEmail(`
      <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
        ${params.firstName ? `Hi ${params.firstName},` : 'Hi there,'}
      </p>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Here's a pro tip to get more value from AppTrack:
      </p>
      <div style="margin: 0 0 24px; padding: 20px; background-color: #fafafa; border-radius: 6px; border-left: 4px solid #18181b;">
        <p style="margin: 0 0 8px; font-size: 16px; color: #18181b; font-weight: 600;">Run Job Fit Analysis Before Every Application</p>
        <p style="margin: 0; font-size: 14px; color: #3f3f46;">
          Before applying to any job, run a quick fit analysis. It takes 30 seconds and tells you exactly what to emphasize in your cover letter and how to tailor your resume.
        </p>
      </div>
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Pro users who do this report higher callback rates. The AI spots things you might miss!
      </p>
      ${ctaButton('Try It Now', `${APP_URL}/try/job-fit`)}
    `, params),
  },
];

// ============================================
// EXPORTS
// ============================================

export const DRIP_TEMPLATES: Record<AudienceId, DripTemplate[]> = {
  'leads': leadsTemplates,
  'free-users': freeUsersTemplates,
  'trial-users': trialUsersTemplates,
  'paid-users': paidUsersTemplates,
};

/**
 * Get all templates for an audience
 */
export function getTemplatesForAudience(audienceId: AudienceId): DripTemplate[] {
  return DRIP_TEMPLATES[audienceId] || [];
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templateId: string): DripTemplate | null {
  for (const templates of Object.values(DRIP_TEMPLATES)) {
    const found = templates.find(t => t.templateId === templateId);
    if (found) return found;
  }
  return null;
}

/**
 * Get the schedule (day offsets) for an audience
 */
export function getScheduleForAudience(audienceId: AudienceId): number[] {
  const templates = DRIP_TEMPLATES[audienceId] || [];
  return templates.map(t => t.dayOffset).sort((a, b) => a - b);
}
