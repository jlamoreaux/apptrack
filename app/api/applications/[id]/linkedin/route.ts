import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const LinkedInProfileSchema = z.object({
  profile_url: z.string().url("Must be a valid LinkedIn URL"),
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  headline: z.string().optional(),
  profile_photo_url: z.string().url().optional(),
});

// GET /api/applications/[id]/linkedin - Get all LinkedIn profiles for an application
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: applicationId } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profiles access attempt', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profiles_get_unauthorized',
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // First verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      loggerService.warn('Application not found for LinkedIn profiles', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profiles_application_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Get LinkedIn profiles for this application
    const { data: profiles, error } = await supabase
      .from("linkedin_profiles")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching LinkedIn profiles', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profiles_fetch_error',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Failed to fetch LinkedIn profiles" }, { status: 500 });
    }

    loggerService.info('LinkedIn profiles retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profiles_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        applicationId,
        profileCount: profiles?.length || 0
      }
    });

    return NextResponse.json({ profiles: profiles || [] });

  } catch (error) {
    loggerService.error('LinkedIn profiles GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profiles_get_exception',
      duration: Date.now() - startTime,
      metadata: { applicationId }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/applications/[id]/linkedin - Add a LinkedIn profile to an application
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: applicationId } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profile creation attempt', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profile_create_unauthorized',
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // First verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      loggerService.warn('Application not found for LinkedIn profile creation', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_application_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = LinkedInProfileSchema.parse(body);

    // Extract username from URL
    const username = validatedData.profile_url.match(/linkedin\.com\/in\/([^/?]+)/i)?.[1] || null;
    
    // Insert LinkedIn profile
    const { data: profile, error } = await supabase
      .from("linkedin_profiles")
      .insert([
        {
          application_id: applicationId,
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
        action: 'linkedin_profile_create_error',
        duration: Date.now() - startTime,
        metadata: {
          applicationId,
          profileUrl: validatedData.profile_url
        }
      });
      return NextResponse.json({ error: "Failed to create LinkedIn profile" }, { status: 500 });
    }

    loggerService.info('LinkedIn profile created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profile_created',
      duration: Date.now() - startTime,
      metadata: {
        applicationId,
        profileId: profile?.id,
        username,
        profileUrl: validatedData.profile_url,
        hasName: !!validatedData.name,
        hasTitle: !!validatedData.title,
        hasCompany: !!validatedData.company
      }
    });

    return NextResponse.json({ profile }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      loggerService.warn('LinkedIn profile validation error', {
        category: LogCategory.API,
        userId: user?.id,
        action: 'linkedin_profile_create_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          applicationId,
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
      action: 'linkedin_profile_create_exception',
      duration: Date.now() - startTime,
      metadata: { applicationId }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/applications/[id]/linkedin/[profileId] - Update a LinkedIn profile
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: applicationId } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profile update attempt', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profile_update_unauthorized',
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      loggerService.warn('LinkedIn profile update missing profile ID', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_update_missing_id',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // First verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      loggerService.warn('Application not found for LinkedIn profile update', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_update_app_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId, profileId }
      });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { notes, name, title, company } = body;

    // Build update object with only provided fields
    const updates: any = {};
    if (notes !== undefined) updates.notes = notes;
    if (name !== undefined) updates.name = name;
    if (title !== undefined) updates.title = title;
    if (company !== undefined) updates.company = company;

    // Update LinkedIn profile
    const { data: profile, error } = await supabase
      .from("linkedin_profiles")
      .update(updates)
      .eq("id", profileId)
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      loggerService.error('Error updating LinkedIn profile', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profile_update_error',
        duration: Date.now() - startTime,
        metadata: { applicationId, profileId }
      });
      return NextResponse.json({ error: "Failed to update LinkedIn profile" }, { status: 500 });
    }

    loggerService.info('LinkedIn profile updated', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profile_updated',
      duration: Date.now() - startTime,
      metadata: {
        applicationId,
        profileId,
        updatedFields: Object.keys(updates)
      }
    });

    return NextResponse.json({ profile });

  } catch (error) {
    loggerService.error('LinkedIn profiles PATCH error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profile_update_exception',
      duration: Date.now() - startTime,
      metadata: { applicationId, profileId }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/applications/[id]/linkedin?profileId=xxx - Delete a LinkedIn profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id: applicationId } = await params;
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized LinkedIn profile deletion attempt', {
        category: LogCategory.SECURITY,
        action: 'linkedin_profile_delete_unauthorized',
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      loggerService.warn('LinkedIn profile deletion missing profile ID', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_delete_missing_id',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      loggerService.warn('Application not found for LinkedIn profile deletion', {
        category: LogCategory.API,
        userId: user.id,
        action: 'linkedin_profile_delete_app_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId, profileId }
      });
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Delete LinkedIn profile (also verify it belongs to this application)
    const { error } = await supabase
      .from("linkedin_profiles")
      .delete()
      .eq("id", profileId)
      .eq("application_id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      loggerService.error('Error deleting LinkedIn profile', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'linkedin_profile_delete_error',
        duration: Date.now() - startTime,
        metadata: { applicationId, profileId }
      });
      return NextResponse.json({ error: "Failed to delete LinkedIn profile" }, { status: 500 });
    }

    loggerService.info('LinkedIn profile deleted', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'linkedin_profile_deleted',
      duration: Date.now() - startTime,
      metadata: { applicationId, profileId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    loggerService.error('LinkedIn profiles DELETE error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'linkedin_profile_delete_exception',
      duration: Date.now() - startTime,
      metadata: { applicationId, profileId }
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}