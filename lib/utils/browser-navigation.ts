/**
 * A full-page navigation, for destinations the Next.js router can't reach
 * (another site, or an app's custom URL scheme) or that must reload the page
 * with fresh cookies. Its own module so tests can replace it; jsdom's
 * window.location can't be stubbed.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
