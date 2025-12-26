import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscriptions";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { PLAN_LIMITS } from "@/lib/constants/plans";

// This should be called by a cron job (e.g., Vercel Cron or external service)
// Run daily to process trial notifications and expirations
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Optional: Add security token check
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      loggerService.logSecurityEvent(
        'cron_unauthorized_access',
        'high',
        {
          endpoint: '/api/cron/trial-notifications',
          providedAuth: authHeader ? 'present' : 'missing'
        },
        {}
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date();

    // Process pending notifications
    const { data: pendingNotifications } = await supabase
      .from("scheduled_notifications")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", now.toISOString());

    if (pendingNotifications) {
      for (const notification of pendingNotifications) {
        await processNotification(notification);
      }
    }

    // Check for expired trials and premium_free subscriptions
    const { data: expiredSubscriptions } = await supabase
      .from("user_subscriptions")
      .select("*")
      .or("status.eq.trialing,and(status.eq.active,cancel_at_period_end.eq.true)")
      .lte("current_period_end", now.toISOString());

    if (expiredSubscriptions) {
      const subscriptionService = new SubscriptionService();
      
      for (const subscription of expiredSubscriptions) {
        // Cancel the expired subscription
        await subscriptionService.update(subscription.id, {
          status: "canceled",
          cancel_at_period_end: false,
        });

        // Log the expiration
        const subType = subscription.status === 'trialing' ? 'Trial' : 'Premium free access';
        loggerService.info(`${subType} expired`, {
          category: LogCategory.BUSINESS,
          userId: subscription.user_id,
          action: 'subscription_expired',
          metadata: {
            subscriptionId: subscription.id,
            subscriptionType: subType,
            previousStatus: subscription.status
          }
        });
      }
    }

    loggerService.info('Trial notifications cron completed', {
      category: LogCategory.BUSINESS,
      action: 'trial_notifications_completed',
      duration: Date.now() - startTime,
      metadata: {
        notificationsProcessed: pendingNotifications?.length || 0,
        subscriptionsExpired: expiredSubscriptions?.length || 0
      }
    });

    return NextResponse.json({
      success: true,
      notificationsProcessed: pendingNotifications?.length || 0,
      subscriptionsExpired: expiredSubscriptions?.length || 0,
    });
  } catch (error) {
    loggerService.error('Error processing trial notifications', error, {
      category: LogCategory.API,
      action: 'trial_notifications_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    );
  }
}

async function processNotification(notification: any) {
  const supabase = await createClient();
  
  try {
    // Send email based on notification type
    await sendNotificationEmail(
      notification.email,
      notification.type,
      notification.user_id
    );

    // Mark as sent
    await supabase
      .from("scheduled_notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", notification.id);
  } catch (error) {
    loggerService.error(`Failed to send notification ${notification.id}`, error, {
      category: LogCategory.PAYMENT,
      action: 'notification_send_error',
      metadata: {
        notificationId: notification.id,
        notificationType: notification.type,
        userId: notification.user_id
      }
    });
    
    // Mark as failed
    await supabase
      .from("scheduled_notifications")
      .update({
        status: "failed",
        error: String(error),
      })
      .eq("id", notification.id);
  }
}

async function sendNotificationEmail(
  email: string,
  type: string,
  userId: string
) {
  const { sendEmail } = await import('@/lib/email/client');
  
  // Map notification types to email templates
  const emailTemplates = {
    trial_ending_7_days: {
      subject: "Your AI Coach trial ends in 7 days",
      preview: "Make the most of your remaining trial time",
      content: `
        <h2>Your AI Coach trial ends in 7 days</h2>
        <p>We hope you're enjoying the AI-powered features in AppTrack!</p>
        <p>Your trial will end in 7 days, after which you'll automatically return to the free tier.</p>
        <p><strong>Want to continue with AI Coach?</strong></p>
        <p>Upgrade now to keep all your AI-powered features without interruption.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">View Upgrade Options</a>
      `,
    },
    trial_ending_1_day: {
      subject: "Your AI Coach trial ends tomorrow",
      preview: "Last day to upgrade and keep your AI features",
      content: `
        <h2>Your AI Coach trial ends tomorrow</h2>
        <p>This is your final reminder that your AI Coach trial ends tomorrow.</p>
        <p>After tomorrow, you'll lose access to:</p>
        <ul>
          <li>AI Resume Analysis</li>
          <li>Interview Preparation</li>
          <li>Job Fit Analysis</li>
          <li>Cover Letter Generation</li>
        </ul>
        <p><strong>Don't lose your AI coaching!</strong></p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">Upgrade Now</a>
      `,
    },
    trial_ended: {
      subject: "Your AI Coach trial has ended",
      preview: "You can upgrade anytime to regain AI features",
      content: `
        <h2>Your AI Coach trial has ended</h2>
        <p>Thank you for trying AppTrack's AI Coach features!</p>
        <p>You've been automatically moved to the free tier, where you can still:</p>
        <ul>
          <li>Track up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications</li>
          <li>Manage interviews and contacts</li>
          <li>Take interview notes</li>
        </ul>
        <p>Ready for more? You can upgrade to AI Coach anytime to regain access to all AI-powered features.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">View Plans</a>
      `,
    },
    premium_ending_7_days: {
      subject: "Your premium access ends in 7 days",
      preview: "Make the most of your remaining premium time",
      content: `
        <h2>Your premium access ends in 7 days</h2>
        <p>We hope you're enjoying the premium features in AppTrack!</p>
        <p>Your premium access will end in 7 days, after which you'll automatically return to the free tier.</p>
        <p><strong>Want to continue with premium features?</strong></p>
        <p>Upgrade now to keep all your premium features without interruption.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">View Upgrade Options</a>
      `,
    },
    premium_ending_1_day: {
      subject: "Your premium access ends tomorrow",
      preview: "Last day to upgrade and keep your premium features",
      content: `
        <h2>Your premium access ends tomorrow</h2>
        <p>This is your final reminder that your premium access ends tomorrow.</p>
        <p>After tomorrow, you'll lose access to:</p>
        <ul>
          <li>AI Resume Analysis</li>
          <li>Interview Preparation</li>
          <li>Job Fit Analysis</li>
          <li>Cover Letter Generation</li>
        </ul>
        <p><strong>Don't lose your premium features!</strong></p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">Upgrade Now</a>
      `,
    },
    premium_ended: {
      subject: "Your premium access has ended",
      preview: "You can upgrade anytime to regain premium features",
      content: `
        <h2>Your premium access has ended</h2>
        <p>Thank you for using AppTrack's premium features!</p>
        <p>You've been automatically moved to the free tier, where you can still:</p>
        <ul>
          <li>Track up to ${PLAN_LIMITS.FREE_MAX_APPLICATIONS} applications</li>
          <li>Manage interviews and contacts</li>
          <li>Take interview notes</li>
        </ul>
        <p>Ready for more? You can upgrade anytime to regain access to all premium features.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade">View Plans</a>
      `,
    },
  };

  const template = emailTemplates[type as keyof typeof emailTemplates];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  await sendEmail({
    to: email,
    subject: template.subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${template.content}
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; line-height: 18px;">
            You're receiving this email about your AppTrack trial status. To unsubscribe or manage preferences, visit your account settings.
          </p>
        </div>
      </div>
    `,
  });
}