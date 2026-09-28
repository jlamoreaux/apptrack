import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthLayout } from "@/components/auth-layout"
import { SignInForm } from "@/components/forms/sign-in-form"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { AUTH_REDIRECT_TO_PARAM } from "@/lib/constants/routes"
import { SITE_URL } from "@/lib/constants/site-config"
import { signupHref, validInternalPath } from "@/lib/utils/auth-redirect"
import type { SearchParamValue } from "@/types"

export const metadata: Metadata = {
  title: "Login | CareerOtter",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>
}) {
  // Where to go after signing in: the Google button carries it through the
  // auth callback, and the email form reads it from the URL itself.
  const redirectTo = validInternalPath((await searchParams)[AUTH_REDIRECT_TO_PARAM], SITE_URL)

  return (
    <AuthLayout>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Welcome back to CareerOtter</CardTitle>
          <CardDescription>Sign in to your account to continue tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton
            context="signin"
            redirectTo={redirectTo ?? undefined}
            className="mb-4"
          />

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
            <Link href={signupHref(redirectTo)} className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
