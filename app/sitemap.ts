import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/constants/site-config'
import { ROLE_LANDING_PAGES } from '@/lib/constants/free-tools'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.url
  const currentDate = new Date()

  // Core marketing pages - highest priority
  const corePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ]

  // Free tool pages - high priority for SEO traffic
  const toolPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/free-tools`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/roast-my-resume`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/try/cover-letter`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/try/job-fit`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/try/interview-prep`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  // Role-specific landing pages for SEO - generated from constant
  const roleLandingPages: MetadataRoute.Sitemap = ROLE_LANDING_PAGES.map(role => ({
    url: `${baseUrl}/cover-letter-generator/${role.slug}`,
    lastModified: currentDate,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Legal/info pages
  const infoPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  return [...corePages, ...toolPages, ...roleLandingPages, ...infoPages]
}
