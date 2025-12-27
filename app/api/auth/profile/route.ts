import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { z } from "zod";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const ProfileUpdateSchema = z.object({
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional().nullable(),
  email: z.string().email().optional(),
});

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      loggerService.warn('Unauthorized profile access attempt', {
        category: LogCategory.AUTH,
        action: 'profile_get_unauthorized'
      });
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      loggerService.error('Error fetching profile', error, {
        category: LogCategory.AUTH,
        userId: user.id,
        action: 'profile_get_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    loggerService.debug('Profile fetched successfully', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'profile_get_success',
      duration: Date.now() - startTime
    });

    return NextResponse.json({ profile });

  } catch (error) {
    loggerService.error('Profile GET error', error, {
      category: LogCategory.AUTH,
      action: 'profile_get_fatal_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      loggerService.warn('Unauthorized profile update attempt', {
        category: LogCategory.AUTH,
        action: 'profile_update_unauthorized'
      });
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = ProfileUpdateSchema.parse(body);

    // Update profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(validatedData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      loggerService.error('Error updating profile', error, {
        category: LogCategory.AUTH,
        userId: user.id,
        action: 'profile_update_error',
        duration: Date.now() - startTime,
        metadata: {
          updatedFields: Object.keys(validatedData)
        }
      });
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    loggerService.info('Profile updated successfully', {
      category: LogCategory.AUTH,
      userId: user.id,
      action: 'profile_update_success',
      duration: Date.now() - startTime,
      metadata: {
        updatedFields: Object.keys(validatedData)
      }
    });

    return NextResponse.json({ profile });

  } catch (error) {
    if (error instanceof z.ZodError) {
      loggerService.warn('Profile update validation error', {
        category: LogCategory.AUTH,
        action: 'profile_update_validation_error',
        metadata: {
          errors: error.errors
        }
      });
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error('Profile PUT error', error, {
      category: LogCategory.AUTH,
      action: 'profile_update_fatal_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}