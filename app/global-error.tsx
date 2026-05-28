"use client";

import { SUPPORT_EMAIL } from "@/lib/constants/site-config";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Last-resort backstop for errors in the root layout that `(app)/error.tsx`
 * cannot catch. The app shell (providers, components, Tailwind) may be
 * unavailable here, so this UI is fully self-contained with inline styles and a
 * plain `mailto:` support affordance.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const handleReload = () => {
    reset();
    window.location.reload();
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#ffffff",
          color: "#111827",
          padding: "24px",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{ maxWidth: "32rem", width: "100%" }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 12px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 20px", color: "#374151" }}>
            We hit an unexpected problem and could not load the app. Please reload
            the page. If the problem continues, contact our support team.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <button
              type="button"
              onClick={handleReload}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#111827",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 20px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                color: "#111827",
                fontSize: "0.95rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
