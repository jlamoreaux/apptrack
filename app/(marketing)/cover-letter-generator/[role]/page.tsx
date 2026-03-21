import { Metadata } from "next"
import { notFound } from "next/navigation"
import { RoleLandingPage, generateRoleMetadata } from "@/components/landing/role-landing-page"
import { ROLE_LANDING_PAGES } from "@/lib/constants/free-tools"
import { generateRoleContent, ROLE_CONTENT_OVERRIDES } from "@/lib/constants/role-page-content"

interface Props {
  params: { role: string }
}

export async function generateStaticParams() {
  return ROLE_LANDING_PAGES.map((r) => ({ role: r.slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const roleEntry = ROLE_LANDING_PAGES.find((r) => r.slug === params.role)
  if (!roleEntry) return {}
  return generateRoleMetadata(roleEntry.name, roleEntry.slug)
}

export default function RoleCoverLetterPage({ params }: Props) {
  const roleEntry = ROLE_LANDING_PAGES.find((r) => r.slug === params.role)
  if (!roleEntry) notFound()

  const content =
    ROLE_CONTENT_OVERRIDES[roleEntry.slug] ?? generateRoleContent(roleEntry.name)

  // Related roles: 3 others from the same constant, excluding self
  const relatedRoles = ROLE_LANDING_PAGES.filter((r) => r.slug !== roleEntry.slug)
    .slice(0, 3)
    .map((r) => ({ name: r.name, slug: r.slug }))

  return (
    <RoleLandingPage
      role={roleEntry.name}
      roleSlug={roleEntry.slug}
      description={content.description}
      benefits={content.benefits}
      exampleIntro={content.exampleIntro}
      exampleBody={content.exampleBody}
      faqs={content.faqs}
      relatedRoles={relatedRoles}
    />
  )
}
