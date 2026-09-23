import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldClassName } from "@/components/ui/input"

/**
 * A native <select> styled like Input. Use it over the Radix Select when the
 * platform picker matters (mobile) or options need native `disabled` semantics.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select className={cn(fieldClassName, className)} ref={ref} {...props} />
  )
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
