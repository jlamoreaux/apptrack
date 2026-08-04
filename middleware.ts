import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// CareerOtter Phase 2 surfaces (merged to main ahead of launch) stay hidden
// until the launch switch is flipped. Matched with segment boundaries so a route
// like /dashboard/companies could never be caught by /dashboard/comp.
function isCareerotterSurface(pathname: string): boolean {
  const pageRoutes = [
    "/dashboard/start", // Zero-to-Case onboarding
    "/dashboard/wins",
    "/dashboard/coach",
    "/dashboard/comp",
    "/dashboard/data", // privacy/data page
    "/dashboard/review-prep",
  ]
  if (pageRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return true
  }
  return (
    pathname.startsWith("/api/careerotter/") ||
    pathname.startsWith("/api/wins/") ||
    pathname === "/api/wins" ||
    pathname === "/api/cron/careerotter-recap"
  )
}

export async function middleware(request: NextRequest) {
  // Hard launch gate, evaluated before anything else: 404 the not-yet-launched
  // CareerOtter routes unless CAREEROTTER_ENABLED=1. Keeps them unreachable in
  // production while their code sits merged-but-dark on main.
  if (
    process.env.CAREEROTTER_ENABLED !== "1" &&
    isCareerotterSurface(request.nextUrl.pathname)
  ) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const hostname = request.headers.get("host") || ""

  // Redirect non-www to www for canonical URL consistency
  if (hostname === "apptrack.ing") {
    const url = request.nextUrl.clone()
    url.hostname = "www.apptrack.ing"
    return NextResponse.redirect(url, 301)
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options || {})
            })
          },
        },
      },
    )

    // Refresh session if expired - required for Server Components
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
      const redirectUrl = new URL("/login", request.url)
      redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Redirect authenticated users away from auth pages
    if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return supabaseResponse
  } catch (error) {
    // If there's an error with Supabase, just continue without auth
    return NextResponse.next({
      request,
    })
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
    // CareerOtter API + cron surfaces are excluded by the pattern above (api/),
    // so match them explicitly for the launch gate.
    "/api/careerotter/:path*",
    "/api/wins/:path*",
    "/api/cron/careerotter-recap",
  ],
}
