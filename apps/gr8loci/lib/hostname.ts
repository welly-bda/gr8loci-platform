export const PLATFORM_DOMAIN = 'gr8loci.online'

const RESERVED_SUBDOMAINS = new Set(['www'])

export function parseHost(host: string | null): { hostname: string; subdomainSlug: string | null } {
  const hostname = ((host ?? '').split(':')[0] ?? '').toLowerCase()
  if (!hostname) return { hostname: '', subdomainSlug: null }

  const platformSuffix = `.${PLATFORM_DOMAIN}`
  if (hostname.endsWith(platformSuffix)) {
    const label = hostname.slice(0, -platformSuffix.length)
    if (label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)) {
      return { hostname, subdomainSlug: label }
    }
    return { hostname, subdomainSlug: null }
  }

  // dev: <label>.localhost
  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length)
    if (label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)) {
      return { hostname, subdomainSlug: label }
    }
  }

  return { hostname, subdomainSlug: null }
}
