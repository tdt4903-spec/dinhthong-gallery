// Keep category links clear of existing application and legacy album routes.
const RESERVED = new Set(['admin', 'dashboardadmin', 'dashboardsp', 'booking', 'money', 'gallery', 'albumpublic', 'san-pham-khach-hang', 'auth', 'api', 's', 'og', '_next'])

export function getPublicCategoryPath(slug: string): string {
  const segment = RESERVED.has(slug) || slug.startsWith('album-') ? `the-loai-${slug}` : slug
  return `/${encodeURIComponent(segment)}`
}
