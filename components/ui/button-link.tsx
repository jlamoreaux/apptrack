import * as React from "react"
import Link from "next/link"
import { Button, ButtonProps } from "./button"

interface ButtonLinkProps extends Omit<ButtonProps, 'asChild'> {
  href: string
  children: React.ReactNode
}

/**
 * A convenience component that combines Button styling with Next.js Link behavior.
 * This ensures proper HTML semantics (<a> tag) with button styling.
 */
export const ButtonLink = React.forwardRef<
  HTMLAnchorElement,
  ButtonLinkProps
>(({ href, children, ...props }, ref) => {
  return (
    <Button asChild {...props}>
      <Link href={href} ref={ref}>
        {children}
      </Link>
    </Button>
  )
})

ButtonLink.displayName = "ButtonLink"