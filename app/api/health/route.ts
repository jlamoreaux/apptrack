import { NextResponse } from "next/server";

/**
 * Public liveness endpoint. Deliberately says nothing about dependencies —
 * it is the `status` target of the RFC 9727 API catalog, not an internal
 * health dashboard, so it must not leak which services are degraded.
 */

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "careerotter",
      time: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
