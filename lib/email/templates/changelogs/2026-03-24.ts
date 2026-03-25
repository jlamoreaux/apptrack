import type { ChangelogData } from '../changelog';

export const changelog: ChangelogData = {
  weekOf: 'March 17, 2026',
  categories: [
    {
      title: 'New Features',
      items: [
        '5 free AI analyses -- Try Job Fit, Interview Prep, and Cover Letter up to 5 times on us, no subscription required.',
        'Redesigned Try pages -- Cleaner, more polished experience when previewing AI-powered features before signing up.',
        'Faster sign-up -- Google sign-in is now front and center for a quicker onboarding experience.',
      ],
    },
    {
      title: 'Improvements',
      items: [
        'More accurate job fit analysis -- Improved AI accuracy so your job fit results are more relevant and actionable.',
        'Better resume roasts -- More varied, specific, and well-calibrated feedback so each roast feels fresh and useful.',
        'Stronger interview prep guidance -- Better recommendations even if you haven\'t uploaded a resume yet.',
        'Application history tracking -- Status changes on your applications are now tracked so you can see your full timeline.',
      ],
    },
    {
      title: 'Fixes',
      items: [
        'Pipeline chart now displays correctly and is readable in both light and dark mode.',
        'Product tabs no longer overflow on mobile screens.',
        'Various visual polish and brand consistency updates across the site.',
        'Improved security and performance under the hood.',
      ],
    },
  ],
};
