"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Mail, Calendar, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  notes?: string | null;
  full_name: string;
  email: string;
  isCurrentUser: boolean;
}

interface AdminUsersListProps {
  admins: AdminUser[];
}

export function AdminUsersList({ admins }: AdminUsersListProps) {
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<AdminUser | null>(null);
  const router = useRouter();

  const handleRemoveAdmin = async (admin: AdminUser) => {
    setRemovingUserId(admin.user_id);
    
    try {
      const response = await fetch(`/api/admin/users?userId=${admin.user_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove admin");
      }

      // Success - refresh the page
      router.refresh();
    } catch (error) {
      console.error("Error removing admin:", error);
      alert(error instanceof Error ? error.message : "Failed to remove admin");
    } finally {
      setRemovingUserId(null);
      setConfirmRemoveUser(null);
    }
  };

  if (admins.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No admin users found
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{admin.full_name}</p>
                  {admin.isCurrentUser && (
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {admin.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Added {new Date(admin.created_at).toLocaleDateString()}
                  </span>
                </div>
                {admin.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Note: {admin.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!admin.isCurrentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmRemoveUser(admin)}
                  disabled={removingUserId === admin.user_id}
                >
                  {removingUserId === admin.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmRemoveUser} onOpenChange={() => setConfirmRemoveUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove admin access for {confirmRemoveUser?.full_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveUser && handleRemoveAdmin(confirmRemoveUser)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}