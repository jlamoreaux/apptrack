"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants/site-config";

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
            <Link href="/roast-my-resume">
              <Button variant="ghost" className="text-primary hover:text-primary/80">
                🔥 Roast My Resume
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90">Sign Up</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="sm:hidden border-t bg-background">
          <div className="container px-4 py-4 space-y-3">
            <Link href="/roast-my-resume" className="block" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start h-11 text-primary hover:text-primary/80">
                🔥 Roast My Resume
              </Button>
            </Link>
            <Link href="/login" className="block" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start h-11">
                Login
              </Button>
            </Link>
            <Link href="/signup" className="block" onClick={() => setIsOpen(false)}>
              <Button className="w-full bg-primary hover:bg-primary/90 h-11">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
