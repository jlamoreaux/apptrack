import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AuditService } from "@/lib/services/audit.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  ArrowLeft,
  FileText,
  Clock,
  User,
  Activity,
  AlertCircle
} from "lucide-react";

export default async function AuditLogsPage() {
  const user = await getUser();

  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);
  
  if (!isAdmin) {
    notFound();
  }

  // Get recent audit logs (last 100)
  const logs = await AuditService.getAuditLogs({ limit: 100 });

  // Format action names for display
  const formatAction = (action: string) => {
    return action
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  // Get action color
  const getActionColor = (action: string) => {
    if (action.includes('created') || action.includes('added')) return 'text-green-600';
    if (action.includes('deleted') || action.includes('removed')) return 'text-red-600';
    if (action.includes('updated') || action.includes('toggled')) return 'text-blue-600';
    return 'text-gray-600';
  };

  // Stats
  const todayLogs = logs.filter(log => 
    new Date(log.created_at).toDateString() === new Date().toDateString()
  ).length;
  
  const uniqueAdmins = new Set(logs.map(log => log.user_id)).size;

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
        
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Audit Logs</h1>
        </div>
        <p className="text-muted-foreground">
          View all administrative actions and changes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">Last 100 actions</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Actions</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayLogs}</div>
            <p className="text-xs text-muted-foreground">Actions performed today</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
            <User className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueAdmins}</div>
            <p className="text-xs text-muted-foreground">Admins with recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            All administrative actions are logged for security and compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                        {log.entity_type && (
                          <Badge variant="outline" className="text-xs">
                            {log.entity_type}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span>{log.user_name || log.user_email || 'Unknown User'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(log.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {log.metadata?.ip && (
                          <div className="text-xs">
                            IP: {log.metadata.ip}
                          </div>
                        )}
                      </div>

                      {/* Show details for certain actions */}
                      {log.action === 'admin.user.added' && log.new_values && (
                        <div className="mt-2 text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded">
                          Added admin: {log.new_values.email || log.entity_id}
                          {log.new_values.notes && ` - ${log.new_values.notes}`}
                        </div>
                      )}
                      
                      {log.action === 'admin.user.removed' && log.old_values && (
                        <div className="mt-2 text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded">
                          Removed admin: {log.old_values.email || log.entity_id}
                        </div>
                      )}
                      
                      {log.action === 'promo.code.created' && log.new_values && (
                        <div className="mt-2 text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded">
                          Created code: {log.new_values.code}
                          {log.new_values.description && ` - ${log.new_values.description}`}
                        </div>
                      )}
                      
                      {log.action === 'promo.code.toggled' && log.metadata && (
                        <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                          {log.new_values?.active ? 'Activated' : 'Deactivated'} code: {log.metadata.code}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}