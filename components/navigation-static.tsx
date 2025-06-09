import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3 } from "lucide-react"

export function NavigationStatic() {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl text-foreground">AppTrack</span>
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <Link href="/login">
            <Button variant="ghost" className="text-foreground hover:text-foreground">
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-secondary hover:bg-secondary/90 text-white">Sign Up</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
