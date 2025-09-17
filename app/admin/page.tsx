import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Ticket,
  Users,
  BarChart3,
  Settings,
  Database,
  ArrowRight,
  Activity,
  UserCheck,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const user = await getUser();

  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);

  if (!isAdmin) {
    notFound();
  }

  // Get some basic stats
  const adminUsers = await AdminService.getAdminUsers();
  const adminCount = adminUsers.length;

  // Detect environment
  const environment = process.env.NODE_ENV === 'production' ? 'Production' : 'Development';
  const environmentDescription = process.env.NODE_ENV === 'production' ? 'Live environment' : 'Local development';

  const adminSections = [
    {
      title: "Promo Codes",
      description: "Manage promotional codes for trials and discounts",
      icon: Ticket,
      href: "/admin/promo-codes",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      stats: "Active codes",
    },
    {
      title: "Admin Users",
      description: "Manage administrator access and permissions",
      icon: UserCheck,
      href: "/admin/users",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      stats: `${adminCount} admin${adminCount !== 1 ? "s" : ""}`,
    },
    {
      title: "Analytics",
      description: "View platform usage statistics and metrics",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      stats: "Coming soon",
    },
    {
      title: "Database",
      description: "Database management and maintenance tools",
      icon: Database,
      href: "/admin/database",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      stats: "Coming soon",
    },
    {
      title: "Users",
      description: "View and manage all platform users",
      icon: Users,
      href: "/admin/all-users",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      stats: "Coming soon",
    },
    {
      title: "Settings",
      description: "Platform configuration and settings",
      icon: Settings,
      href: "/admin/settings",
      color: "text-gray-500",
      bgColor: "bg-gray-50 dark:bg-gray-950/20",
      stats: "Coming soon",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Manage platform settings, users, and configurations
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Status
              </CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Operational</div>
              <p className="text-xs text-muted-foreground">
                All systems running
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminCount}</div>
              <p className="text-xs text-muted-foreground">
                Active administrators
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Environment</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{environment}</div>
              <p className="text-xs text-muted-foreground">{environmentDescription}</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => {
            const Icon = section.icon;
            const isAvailable = !section.stats.includes("Coming soon");

            return (
              <Card
                key={section.href}
                className={`group hover:shadow-lg transition-all duration-200 ${
                  isAvailable
                    ? "cursor-pointer hover:border-primary"
                    : "opacity-60"
                }`}
              >
                <Link
                  href={isAvailable ? section.href : "#"}
                  className={!isAvailable ? "pointer-events-none" : ""}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${section.bgColor}`}>
                        <Icon className={`h-6 w-6 ${section.color}`} />
                      </div>
                      {isAvailable && (
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <CardTitle className="mt-4">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {section.stats}
                      </span>
                      {isAvailable ? (
                        <Button variant="ghost" size="sm">
                          Manage
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Not available
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/promo-codes">
                <Button variant="outline" size="sm">
                  <Ticket className="h-4 w-4 mr-2" />
                  Create Promo Code
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline" size="sm">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Manage Admins
                </Button>
              </Link>
              <Button variant="outline" size="sm" disabled>
                <Users className="h-4 w-4 mr-2" />
                View All Users
              </Button>
              <Button variant="outline" size="sm" disabled>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
    </>
  );
}
