"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProfileAction } from "@/lib/actions"
import { useActionState } from "react"
import type { User } from "@supabase/supabase-js"
import type { Profile } from "@/lib/supabase"
import { CheckCircle } from "lucide-react"

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface AccountInfoFormProps {
  user: User
  profile: Profile | null
}

export function AccountInfoForm({ user, profile }: AccountInfoFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)
  const [showSuccess, setShowSuccess] = useState(false)

  const {
    register,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      email: user.email || "",
    },
  })

  // Show success message when profile is updated
  if (state?.success && !showSuccess) {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle className="h-4 w-4" />
          Profile updated successfully!
        </div>
      )}

      {state?.error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{state.error}</div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" type="text" {...register("full_name")} disabled={isPending} />
            {errors.full_name && <p className="text-sm text-red-600">{errors.full_name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" {...register("email")} disabled={true} className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email changes require verification. Contact support to change your email.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Account Created</Label>
          <p className="text-sm">{new Date(user.created_at).toLocaleDateString()}</p>
        </div>

        <Button type="submit" disabled={isPending} className="bg-secondary hover:bg-secondary/90">
          {isPending ? "Updating..." : "Update Profile"}
        </Button>
      </form>
    </div>
  )
}
