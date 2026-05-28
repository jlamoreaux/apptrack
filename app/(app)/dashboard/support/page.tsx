export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { SupportForm } from "@/components/support/support-form";

interface SupportPageProps {
  // Next 15 App Router passes searchParams as a Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const errorMessage = firstParamValue(params.errorMessage);

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Contact support
            </h1>
            <p className="text-muted-foreground">
              Describe your issue and we'll reply to your account email.
            </p>
          </div>

          <SupportForm
            source="page"
            initialContext={errorMessage ? { errorMessage } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
