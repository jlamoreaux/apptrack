"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { COPY } from "@/lib/content/copy"
import { cn } from "@/lib/utils"

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
          {COPY.faq.title}
        </h2>
        
        <div className="space-y-4">
          {COPY.faq.items.map((item, index) => (
            <div
              key={index}
              className="border rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium">{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-muted-foreground">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}