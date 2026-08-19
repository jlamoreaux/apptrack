"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FREE_TOOLS } from "@/lib/constants/free-tools";
import { PRICING_TIERS, FAQS } from "@/lib/constants/homepage-content";

/**
 * Exposes CareerOtter's public actions to an in-browser agent via WebMCP
 * (https://webmachinelearning.github.io/webmcp/).
 *
 * Only surfaces that need no account are exposed. Anything behind the dashboard
 * belongs to a signed-in session and is deliberately absent — an agent driving
 * the page has the user's cookies, and tools that mutate their data are not
 * something to hand over without an explicit consent flow.
 *
 * Renders nothing; a no-op in browsers without the API.
 */

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function WebMcpProvider() {
  const router = useRouter();

  useEffect(() => {
    const modelContext = navigator.modelContext;
    if (!modelContext) return;

    const navigable = new Map(
      [
        ...FREE_TOOLS.map((tool) => [tool.href, tool.title] as const),
        ["/free-tools", "All free tools"] as const,
        ["/blog", "Blog"] as const,
        ["/signup", "Create an account"] as const,
        ["/login", "Sign in"] as const,
        ["/terms", "Terms of service"] as const,
        ["/privacy", "Privacy policy"] as const,
      ],
    );

    modelContext.provideContext({
      tools: [
        {
          name: "list_free_tools",
          description:
            "List CareerOtter's free AI tools for job seekers — cover letter generation, resume/job fit scoring, interview prep, and resume roasting. No account needed to use any of them.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          execute: () =>
            text(
              FREE_TOOLS.map((tool) => ({
                title: tool.title,
                description: tool.description,
                path: tool.href,
                highlights: tool.features,
              })),
            ),
        },
        {
          name: "get_pricing",
          description:
            "Get CareerOtter's current plans, prices, and what each tier includes.",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          execute: () =>
            text(
              PRICING_TIERS.map((tier) => ({
                name: tier.name,
                price: tier.price,
                cadence: tier.cadence,
                summary: tier.tagline,
                includes: tier.features,
              })),
            ),
        },
        {
          name: "answer_common_question",
          description:
            "Answer a frequently asked question about CareerOtter — plan differences, whether a card is required, how the AI coach works, and data privacy. Call with no arguments to get every question and answer.",
          inputSchema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description:
                  "Optional. Free text; the closest matching FAQ entry is returned.",
              },
            },
            additionalProperties: false,
          },
          execute: (args) => {
            const query = typeof args.question === "string" ? args.question.toLowerCase() : "";
            if (!query) return text(FAQS);

            const words = query.split(/\W+/).filter((word) => word.length > 3);
            const scored = FAQS.map((faq) => ({
              faq,
              score: words.filter((word) => faq.question.toLowerCase().includes(word)).length,
            })).sort((a, b) => b.score - a.score);

            return text(scored[0].score > 0 ? scored[0].faq : FAQS);
          },
        },
        {
          name: "open_careerotter_page",
          description:
            "Navigate this tab to a CareerOtter page so the user can act on it — for example the resume roast or the cover letter generator. Call list_free_tools first to get valid paths.",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Site-relative path, for example /roast-my-resume.",
              },
            },
            required: ["path"],
            additionalProperties: false,
          },
          execute: (args) => {
            const path = typeof args.path === "string" ? args.path : "";
            const title = navigable.get(path);

            if (!title) {
              return {
                ...text(
                  `"${path}" is not a page this tool can open. Valid paths: ${[...navigable.keys()].join(", ")}`,
                ),
                isError: true,
              };
            }

            router.push(path);
            return text(`Opened ${title} (${path}).`);
          },
        },
      ],
    });
  }, [router]);

  return null;
}
