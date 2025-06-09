import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavigationStatic } from "@/components/navigation-static"
import { Target, FileText, Users, Heart, BarChart3, CheckCircle, Infinity } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-primary/5">
      <NavigationStatic />
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-6">
                <BarChart3 className="h-16 w-16 text-primary mr-4" />
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground">AppTrack</h1>
              </div>
              <p className="text-xl text-foreground max-w-2xl mx-auto">
                The smart way to track your job applications. Stay organized and never lose track of your job search
                progress. Start free with 5 applications, then upgrade to Pro for unlimited tracking.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white"
                >
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Features Grid - Now before pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Track Applications</h3>
                <p className="text-sm text-muted-foreground">
                  Keep track of every application with company details, role information, and application dates.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center border border-secondary/20">
                  <FileText className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-foreground">Interview Notes</h3>
                <p className="text-sm text-muted-foreground">
                  Document interview experiences, questions asked, and follow-up actions.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Network Contacts</h3>
                <p className="text-sm text-muted-foreground">
                  Save LinkedIn profiles and networking contacts for each application.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center border border-secondary/20">
                  <Heart className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-foreground">Ethical Billing</h3>
                <p className="text-sm text-muted-foreground">
                  We'll remind you to cancel your subscription when you get hired. We don't want you paying for
                  something you no longer need.
                </p>
              </div>
            </div>

            {/* Pricing Section - Now after features */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-8">Simple, Transparent Pricing</h2>
              <div className="bg-primary/5 rounded-lg p-6 max-w-2xl mx-auto border border-primary/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="text-center p-4 bg-white/50 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <CheckCircle className="h-5 w-5 text-primary mr-2" />
                      <h3 className="font-semibold text-lg text-foreground">Free Plan</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">Perfect for getting started</p>
                    <ul className="text-sm space-y-2 text-left">
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5" />
                        <span>Up to 5 applications</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5" />
                        <span>Application tracking</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5" />
                        <span>Interview notes</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-primary mr-2 mt-0.5" />
                        <span>Contact management</span>
                      </li>
                    </ul>
                  </div>
                  <div className="text-center p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                    <div className="flex items-center justify-center mb-2">
                      <Infinity className="h-5 w-5 text-secondary mr-2" />
                      <h3 className="font-semibold text-lg text-foreground">Pro Plan</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">For serious job seekers</p>
                    <p className="text-2xl font-bold text-foreground mb-4">
                      $2<span className="text-sm font-normal">/month</span>
                    </p>
                    <ul className="text-sm space-y-2 text-left">
                      <li className="flex items-start">
                        <Infinity className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                        <span>Unlimited applications</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                        <span>All Free plan features</span>
                      </li>
                      <li className="flex items-start">
                        <Heart className="h-4 w-4 text-secondary mr-2 mt-0.5" />
                        <span>Cancel reminder when hired</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
