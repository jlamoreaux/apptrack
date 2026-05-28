import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
}

export const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.FROM_EMAIL || 'AppTrack <onboarding@resend.dev>',
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  if (!resend) {
    return { success: true, mock: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    throw error;
  }
}