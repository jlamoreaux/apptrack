import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NavigationStatic } from "@/components/navigation-static"
import { SignUpForm } from "@/components/forms/sign-up-form"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <div className="container mx-auto flex items-center justify-center min-h-[calc(100vh-3.5rem)] py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Join AppTrack</CardTitle>
            <CardDescription>Create your account to start tracking job applications</CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm />
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
