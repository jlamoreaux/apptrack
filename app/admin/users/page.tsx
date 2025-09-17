import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddAdminDialog } from "./add-admin-dialog";
import { AdminUsersList } from "./admin-users-list";
import { 
  Shield, 
  ArrowLeft,
  UserCheck,
  Calendar
} from "lucide-react";

export default async function AdminUsersPage() {
  const user = await getUser();

  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);
  
  if (!isAdmin) {
    notFound();
  }

  // Get all admin users
  const adminUsers = await AdminService.getAdminUsers();
  
  // Get user profiles for each admin
  const supabase = await createClient();
  const adminUserIds = adminUsers.map(admin => admin.user_id);
  
  // Fetch profiles for all admin users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", adminUserIds);
  
  // Map admin users with their profile details
  const adminsWithDetails = adminUsers.map(admin => {
    const profile = profiles?.find(p => p.user_id === admin.user_id);
    
    return {
      ...admin,
      full_name: profile?.full_name || "Unknown User",
      email: profile?.email || "No email",
      isCurrentUser: admin.user_id === user.id
    };
  });

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Admin Users</h1>
            </div>
            <p className="text-muted-foreground">
              Manage administrator access and permissions
            </p>
          </div>
          
          <AddAdminDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminsWithDetails.length}</div>
              <p className="text-xs text-muted-foreground">Active administrators</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Role</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Admin</div>
              <p className="text-xs text-muted-foreground">Full access granted</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Added</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {adminsWithDetails[0]?.created_at 
                  ? new Date(adminsWithDetails[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Most recent admin</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Administrator List</CardTitle>
            <CardDescription>
              All users with administrative privileges on the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUsersList admins={adminsWithDetails} />
          </CardContent>
        </Card>
    </>
  );
}