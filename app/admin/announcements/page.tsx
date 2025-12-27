import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AnnouncementsManager } from "./announcements-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AnnouncementsPage() {
  const user = await getUser();
  
  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);
  
  if (!isAdmin) {
    notFound();
  }

  const supabase = await createClient();
  
  // Fetch existing announcements
  const { data: announcements, error } = await supabase
    .from('announcements')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Announcement Management</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage platform-wide announcements and notifications
        </p>
      </div>
      
      <AnnouncementsManager 
        initialAnnouncements={announcements || []} 
        userId={user.id}
      />
    </div>
  );
}