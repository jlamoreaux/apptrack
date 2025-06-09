import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        try {
          if (!cookieStore) return []
          const allCookies = cookieStore.getAll()
          return allCookies || []
        } catch (error) {
          console.error("Error getting cookies:", error)
          return []
        }
      },
      setAll(cookiesToSet) {
        try {
          if (!cookieStore) return
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options || {})
            } catch (error) {
              // Ignore individual cookie set errors
              console.warn(`Failed to set cookie ${name}:`, error)
            }
          })
        } catch (error) {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
          console.warn("Error setting cookies:", error)
        }
      },
    },
  })
}

// Alternative client for middleware
export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })
}
