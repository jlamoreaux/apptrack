"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteAccountAction } from "@/lib/actions";
import { useFeatureFlag, FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag";
import type { UserSubscription } from "@/lib/supabase";
import { isEntitledStatus } from "@/lib/constants/subscription-status";

interface DangerZoneProps {
  userId: string;
  subscription: UserSubscription | null;
}

export function DangerZoneCard({ userId, subscription }: DangerZoneProps) {
  const isAuditEnabled = useFeatureFlag(FEATURE_FLAGS.DASHBOARD_UX_AUDIT);
  return (
    <Card className={isAuditEnabled ? "border-destructive/20" : "border-red-200"}>
      <CardHeader>
        <CardTitle className={isAuditEnabled ? "text-destructive" : "text-red-600"}>Danger Zone</CardTitle>
        <CardDescription>
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DangerZone userId={userId} subscription={subscription} />
      </CardContent>
    </Card>
  );
}

export function DangerZone({ userId, subscription }: DangerZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalTitle, setModalTitle] = useState("");

  const isOnPaidPlan =
    subscription?.subscription_plans?.name !== "Free" &&
    isEntitledStatus(subscription?.status);
  const confirmationText = "DELETE MY ACCOUNT";
  const isAuditEnabled = useFeatureFlag(FEATURE_FLAGS.DASHBOARD_UX_AUDIT);

  const handleDeleteAccount = async () => {
    if (confirmText !== confirmationText) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("userId", userId);

      const result = await deleteAccountAction(formData);

      if (result?.error) {
        setModalTitle("Error");
        setModalMessage(result.error);
        setModalOpen(true);
      } else {
        setModalTitle("Account Deleted");
        setModalMessage("Your account has been deleted successfully.");
        setModalOpen(true);
        // Optionally redirect after closing modal
      }
    } catch (error) {
      setModalTitle("Error");
      setModalMessage(
        "Something went wrong. Please try again or contact support."
      );
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 p-4 rounded-lg ${isAuditEnabled ? "border border-destructive/20 bg-destructive/5" : "border border-red-200 bg-red-50"}`}>
        <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isAuditEnabled ? "text-destructive" : "text-red-600"}`} />
        <div className="space-y-2">
          <h3 className={`font-semibold ${isAuditEnabled ? "text-foreground" : "text-red-900"}`}>Delete Account</h3>
          <p className={`text-sm ${isAuditEnabled ? "text-muted-foreground" : "text-red-700"}`}>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          {isOnPaidPlan && (
            <p className={`text-sm font-medium ${isAuditEnabled ? "text-destructive" : "text-red-700"}`}>
              You have an active subscription that will be canceled
              immediately.
            </p>
          )}
          <ul className={`text-xs space-y-1 ml-4 ${isAuditEnabled ? "text-destructive" : "text-red-600"}`}>
            <li>• All your job applications and notes will be deleted</li>
            <li>• Your LinkedIn contacts will be removed</li>
            <li>• Your subscription will be canceled (if active)</li>
            <li>• This action is irreversible</li>
          </ul>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className={isAuditEnabled ? "" : "bg-red-600 hover:bg-red-700"}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isAuditEnabled ? "text-destructive" : "text-red-600"}`}>
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This will permanently delete your account and all associated
                data.
              </p>
              {isOnPaidPlan && (
                <p className={`font-medium ${isAuditEnabled ? "text-destructive" : "text-red-600"}`}>
                  Your active subscription will be canceled immediately.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type{" "}
                <span className="font-mono font-bold">{confirmationText}</span>{" "}
                to confirm:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmationText}
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter className="flex-col space-y-2">
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={confirmText !== confirmationText || loading}
              className={`w-full ${isAuditEnabled ? "" : "bg-red-600 hover:bg-red-700"}`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting Account...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal for error/success messages */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>{modalMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setModalOpen(false)} autoFocus>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
