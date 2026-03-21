import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthLayout } from "@/components/auth-layout"
import { SignInForm } from "@/components/forms/sign-in-form"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"

export const metadata: Metadata = {
  title: "Login | AppTrack",
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Welcome back to AppTrack</CardTitle>
          <CardDescription>Sign in to your account to continue tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton context="signin" className="mb-4" />

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <SignInForm />
          <div className="mt-4 text-center text-sm">
            {"Don't have an account? "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
