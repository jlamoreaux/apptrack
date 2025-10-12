import Link from "next/link";
import { Zap, Trophy, Star } from "lucide-react";

export function BenefitsSection() {
  return (
    <div className="max-w-4xl mx-auto text-center space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        Why Choose a Paid Plan?
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border">
          <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <h3 className="font-semibold text-foreground mb-1">
            Land Jobs Faster
          </h3>
          <p className="text-sm text-muted-foreground">
            Track unlimited applications and stay organized throughout your
            search
          </p>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <Trophy className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <h3 className="font-semibold text-foreground mb-1">Stand Out</h3>
          <p className="text-sm text-muted-foreground">
            AI-powered tools help you craft winning resumes and ace
            interviews
          </p>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
          <h3 className="font-semibold text-foreground mb-1">Save Time</h3>
          <p className="text-sm text-muted-foreground">
            Automated tracking and AI assistance means less busywork, more
            results
          </p>
        </div>
      </div>

      <div className="pt-6">
        <p className="text-muted-foreground">
          Not ready to commit?
          <Link
            href="/dashboard"
            className="text-primary hover:underline ml-1"
          >
            Continue with Free plan
          </Link>
        </p>
      </div>
    </div>
  );
}