import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const LinkedInProfileSchema = z.object({
  application_id: z.string().uuid("Must be a valid application ID"),
  profile_url: z.string().url("Must be a valid LinkedIn URL"),
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  profile_photo_url: z.string().url().optional(),
});

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profiles list access', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profiles_list_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get LinkedIn profiles
    const { data: profiles, error } = await supabase
      .from("linkedin_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching LinkedIn profiles', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profiles_list_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch LinkedIn profiles" }, { status: 500 });
    }

    loggerService.info('LinkedIn profiles list retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profiles_list_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        profileCount: profiles?.length || 0
      }
    });

    return NextResponse.json({ profiles });

  } catch (error) {
    loggerService.error('LinkedIn profiles GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profiles_list_exception',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profile creation', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profile_bulk_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = LinkedInProfileSchema.parse(body);

    const supabase = await createClient();

    // Extract username from URL
    const username = validatedData.profile_url.match(/linkedin\.com\/in\/([^/?]+)/i)?.[1] || null;
    
    // Insert LinkedIn profile
    const { data: profile, error } = await supabase
      .from("linkedin_profiles")
      .insert([
        {
          application_id: validatedData.application_id,
          profile_url: validatedData.profile_url,
          username,
          name: validatedData.name,
          title: validatedData.title,
          company: validatedData.company,
          location: validatedData.location,
          headline: validatedData.headline,
          profile_photo_url: validatedData.profile_photo_url,
          user_id: user.id,
        }
      ])
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating LinkedIn profile', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profile_bulk_create_error',
        duration: Date.now() - startTime,
        metadata: {
          applicationId: validatedData.application_id,
          profileUrl: validatedData.profile_url
        }
      });
      return NextResponse.json({ error: "Failed to create LinkedIn profile" }, { status: 500 });
    }

    loggerService.info('LinkedIn profile created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profile_bulk_created',
      duration: Date.now() - startTime,
      metadata: {
        profileId: profile?.id,
        applicationId: validatedData.application_id,
        username,
        profileUrl: validatedData.profile_url
      }
    });

    return NextResponse.json({ profile }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      loggerService.warn('LinkedIn profile validation error', {
        category: LogCategory.API,
        userId: user?.id,
        action: 'linkedin_profile_bulk_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          validationErrors: error.errors
        }
      });
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error('LinkedIn profiles POST error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profile_bulk_create_exception',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profile bulk deletion', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profile_bulk_delete_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("id");

    if (!profileId) {
      loggerService.warn('LinkedIn profile deletion missing ID', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_bulk_delete_missing_id',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Delete LinkedIn profile (verify ownership)
    const { error } = await supabase
      .from("linkedin_profiles")
      .delete()
      .eq("id", profileId)
      .eq("user_id", user.id);

    if (error) {
      loggerService.error('Error deleting LinkedIn profile', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profile_bulk_delete_error',
        duration: Date.now() - startTime,
        metadata: { profileId }
      });
      return NextResponse.json({ error: "Failed to delete LinkedIn profile" }, { status: 500 });
    }

    loggerService.info('LinkedIn profile deleted', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profile_bulk_deleted',
      duration: Date.now() - startTime,
      metadata: { profileId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    loggerService.error('LinkedIn profiles DELETE error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profile_bulk_delete_exception',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}