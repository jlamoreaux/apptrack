import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NavigationStatic } from "@/components/navigation-static"
import { SignInForm } from "@/components/forms/sign-in-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome back to AppTrack</CardTitle>
            <CardDescription>Sign in to your account to continue tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
            <div className="mt-4 text-center text-sm">
              {"Don't have an account? "}
              <Link href="/signup" className="underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
