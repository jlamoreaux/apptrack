import type { Metadata } from "next"
import SignUpPageClient from "./signup-page-client"

export const metadata: Metadata = {
  title: "Sign Up | AppTrack",
  robots: {
    index: false,
    follow: false,
  },
}

export default function SignUpPage() {
  return <SignUpPageClient />
}
