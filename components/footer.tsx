import Link from "next/link";
import { SITE_CONFIG } from "@/lib/constants/site-config";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Link
            href="/free-tools"
            className="text-foreground font-medium hover:text-primary transition-colors"
          >
            Free Job Search Tools
          </Link>
          <p>
            © {currentYear} {SITE_CONFIG.name}. All rights reserved.
          </p>
          <div className="flex items-baseline gap-3">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link
              href="/cookies"
              className="hover:text-foreground transition-colors"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}