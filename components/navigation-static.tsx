"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
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

export function NavigationStatic() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
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
              🔥 Roast My Resume
            </ButtonLink>
            <ButtonLink href="/login" variant="ghost">
              Login
            </ButtonLink>
            <ButtonLink
              href="/signup"
              className="bg-primary hover:bg-primary/90"
            >
              Sign Up
            </ButtonLink>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="sm:hidden border-t bg-background">
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent"
                >
                  <tool.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{tool.title}</span>
                </Link>
              ))}
            </div>

            <div className="border-t my-2" />

            <ButtonLink
              href="/roast-my-resume"
              variant="ghost"
              className="w-full justify-start h-11 text-primary hover:text-primary/80"
              onClick={() => setIsOpen(false)}
            >
              🔥 Roast My Resume
            </ButtonLink>
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
              className="w-full bg-primary hover:bg-primary/90 h-11"
              onClick={() => setIsOpen(false)}
            >
              Sign Up
            </ButtonLink>
          </div>
        </div>
      )}
    </nav>
  );
}
