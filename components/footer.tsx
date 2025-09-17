import Link from "next/link";
import { SITE_CONFIG } from "@/lib/constants/site-config";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Section */}
          {/* <div className="md:col-span-1">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">{SITE_CONFIG.name}</span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              {SITE_CONFIG.description}
            </p>
          </div> */}

          {/* Product Links */}
          {/* <div>
            <h3 className="text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link 
                  href="/dashboard" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  href="/dashboard/add" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Add Application
                </Link>
              </li>
              <li>
                <Link 
                  href="/dashboard/ai-coach" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  AI Coach
                </Link>
              </li>
              <li>
                <Link 
                  href="/dashboard/upgrade" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Upgrade
                </Link>
              </li>
            </ul>
          </div> */}

          {/* Support Links */}
          {/* <div>
            <h3 className="text-sm font-semibold text-foreground">Support</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link 
                  href="/help" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link 
                  href="/feedback" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Feedback
                </Link>
              </li>
            </ul>
          </div> */}

          {/* Legal Links */}
          <div className="md:col-span-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
            <ul className="flex flex-row gap-4 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li className="text-muted-foreground">•</li>
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li className="text-muted-foreground">•</li>
              <li>
                <Link
                  href="/cookies"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © {currentYear} {SITE_CONFIG.name}. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Made with ❤️ for job seekers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
