import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/constants/site-config'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.url

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/onboarding/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
