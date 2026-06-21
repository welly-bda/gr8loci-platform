import { describe, it, expect } from 'vitest'
import { parseHost } from './hostname'

describe('parseHost', () => {
  it('lowercases and strips the port', () => {
    expect(parseHost('GR8LOCI.online:3005').hostname).toBe('gr8loci.online')
  })
  it('extracts a subdomain slug under the platform domain', () => {
    expect(parseHost('acme.gr8loci.online').subdomainSlug).toBe('acme')
  })
  it('treats apex and www as no subdomain slug', () => {
    expect(parseHost('gr8loci.online').subdomainSlug).toBeNull()
    expect(parseHost('www.gr8loci.online').subdomainSlug).toBeNull()
  })
  it('extracts slug from *.localhost dev hosts', () => {
    expect(parseHost('acme.localhost:3005').subdomainSlug).toBe('acme')
  })
  it('returns null subdomain for plain localhost and custom domains', () => {
    expect(parseHost('localhost:3005').subdomainSlug).toBeNull()
    expect(parseHost('example.com').subdomainSlug).toBeNull()
  })
  it('handles a null host', () => {
    expect(parseHost(null).hostname).toBe('')
  })
})
