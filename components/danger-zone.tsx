"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Loader2 } from "lucide-react"
import { deleteAccountAction } from "@/lib/actions"
import type { UserSubscription } from "@/lib/supabase"

interface DangerZoneProps {
  userId: string
  subscription: UserSubscription | null
}

export function DangerZone({ userId, subscription }: DangerZoneProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)

  const isOnPaidPlan = subscription?.subscription_plans?.name !== "Free" && subscription?.status === "active"
  const confirmationText = "DELETE MY ACCOUNT"

  const handleDeleteAccount = async () => {
    if (confirmText !== confirmationText) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("userId", userId)

      const result = await deleteAccountAction(formData)

      if (result?.error) {
        alert(result.error)
      } else {
        // Account deleted successfully, user will be redirected
        alert("Your account has been deleted successfully.")
      }
    } catch (error) {
      console.error("Error deleting account:", error)
      alert("Something went wrong. Please try again or contact support.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <h3 className="font-semibold text-red-900">Delete Account</h3>
          <p className="text-sm text-red-700">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          {isOnPaidPlan && (
            <p className="text-sm text-red-700 font-medium">
              ⚠️ You have an active subscription that will be canceled immediately.
            </p>
          )}
          <ul className="text-xs text-red-600 space-y-1 ml-4">
            <li>• All your job applications and notes will be deleted</li>
            <li>• Your LinkedIn contacts will be removed</li>
            <li>• Your subscription will be canceled (if active)</li>
            <li>• This action is irreversible</li>
          </ul>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>This will permanently delete your account and all associated data.</p>
              {isOnPaidPlan && (
                <p className="text-red-600 font-medium">Your active subscription will be canceled immediately.</p>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type <span className="font-mono font-bold">{confirmationText}</span> to confirm:
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
              className="w-full bg-red-600 hover:bg-red-700"
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
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
