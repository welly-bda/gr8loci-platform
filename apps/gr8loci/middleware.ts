import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { parseHost } from '@/lib/hostname'
import { forPlatform } from '@/lib/db/platform'

export const runtime = 'nodejs'

const SECRET = new TextEncoder().encode(process.env.AUTH_STUB_SECRET)

async function guardAdmin(req: NextRequest): Promise<NextResponse | undefined> {
  const path = req.nextUrl.pathname
  if (path === '/admin/login') return
  const token = req.cookies.get('admin_session')?.value
  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))
  try {
    await jwtVerify(token, SECRET)
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

async function resolveBlogId(req: NextRequest): Promise<string | null> {
  const { hostname, subdomainSlug } = parseHost(req.headers.get('host'))
  const db = forPlatform()
  // Exact Domain match first (apex, www, custom, dev hosts).
  const domain = await db.domain.findUnique({
    where: { hostname },
    select: { blogId: true, blog: { select: { status: true } } },
  })
  if (domain && domain.blog.status === 'active') return domain.blogId
  // Then subdomain slug.
  if (subdomainSlug) {
    const blog = await db.blog.findFirst({
      where: { slug: subdomainSlug, status: 'active' },
      select: { id: true },
    })
    if (blog) return blog.id
  }
  return null
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (path.startsWith('/admin')) {
    return (await guardAdmin(req)) ?? NextResponse.next()
  }

  const blogId = await resolveBlogId(req)
  if (!blogId) {
    // Rewrite to /not-found which calls notFound() server-side, ensuring a real 404 status.
    return NextResponse.rewrite(new URL('/not-found', req.url))
  }
  const requestHeaders = new Headers(req.headers)
  requestHeaders.delete('x-blog-id') // never trust an inbound value
  requestHeaders.set('x-blog-id', blogId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
