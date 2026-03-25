"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Menu,
  X,
  ChevronDown,
  BarChart3,
  FileText,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SITE_CONFIG } from "@/lib/constants/site-config";

const TRY_TOOLS = [
  {
    title: "Job Fit Analysis",
    description: "See how well you match a job",
    href: "/try/job-fit",
    icon: BarChart3,
  },
  {
    title: "Cover Letter Generator",
    description: "Create tailored cover letters",
    href: "/try/cover-letter",
    icon: FileText,
  },
  {
    title: "Interview Prep",
    description: "Get personalized questions",
    href: "/try/interview-prep",
    icon: MessageSquare,
  },
];

interface NavigationStaticProps {
  isAuthenticated?: boolean;
}

export function NavigationStatic({ isAuthenticated = false }: NavigationStaticProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav id="main-navigation" className={`sticky top-0 z-50 transition-all duration-normal bg-background border-b ${isScrolled ? "shadow-sm border-border" : "border-transparent"}`}>
      <div className="container flex h-14 items-center px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo_square.png"
            alt="AppTrack Logo"
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <span className="font-bold text-lg sm:text-xl text-primary">
            {SITE_CONFIG.name}
          </span>
        </Link>

        <div className="ml-auto flex items-center">
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1">
                  Tools
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {TRY_TOOLS.map((tool) => (
                  <DropdownMenuItem key={tool.href} asChild>
                    <Link
                      href={tool.href}
                      className="flex items-start gap-3 p-2 cursor-pointer"
                    >
                      <tool.icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">{tool.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {tool.description}
                        </div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ButtonLink
              href="/roast-my-resume"
              variant="ghost"
              className="text-primary hover:text-primary/80"
            >
              Roast My Resume
            </ButtonLink>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}
            {isAuthenticated ? (
              <ButtonLink
                href="/dashboard"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Go to Dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">
                  Login
                </ButtonLink>
                <ButtonLink
                  href="/signup"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  Sign Up
                </ButtonLink>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-interactive-hover focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="sm:hidden border-t bg-background overflow-hidden"
          >
            <div className="container px-4 py-4 space-y-1">
              <div className="py-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-2">
                  Tools
                </div>
                {TRY_TOOLS.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-interactive-hover"
                  >
                    <tool.icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{tool.title}</span>
                  </Link>
                ))}
              </div>

              <div className="border-t my-2" />

              {mounted && (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-11"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5 mr-2" />
                  ) : (
                    <Moon className="h-5 w-5 mr-2" />
                  )}
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </Button>
              )}

              <ButtonLink
                href="/roast-my-resume"
                variant="ghost"
                className="w-full justify-start h-11 text-primary hover:text-primary/80"
                onClick={() => setIsOpen(false)}
              >
                Roast My Resume
              </ButtonLink>
              {isAuthenticated ? (
                <ButtonLink
                  href="/dashboard"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11"
                  onClick={() => setIsOpen(false)}
                >
                  Go to Dashboard
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink
                    href="/login"
                    variant="ghost"
                    className="w-full justify-start h-11"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </ButtonLink>
                  <ButtonLink
                    href="/signup"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign Up
                  </ButtonLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
