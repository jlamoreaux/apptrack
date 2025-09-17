import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { NavigationServer } from "@/components/navigation-server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // Return 404 if not logged in or not admin
  if (!user) {
    notFound();
  }

  // Check if user is admin
  const isAdmin = await AdminService.isAdmin(user.id);
  
  if (!isAdmin) {
    // Return 404 for non-admins
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* @ts-expect-error Server Component */}
      <NavigationServer />
      
      <main className="container mx-auto px-4 py-6 sm:py-8">
        {children}
        
        {/* Global Admin Security Notice - Appears on all admin pages */}
        <Card className="mt-8 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              Administrator Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have administrator privileges. Please be careful when making changes as they affect all users.
              All admin actions are logged for security purposes.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}