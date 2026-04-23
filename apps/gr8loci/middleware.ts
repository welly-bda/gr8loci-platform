import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.AUTH_STUB_SECRET)

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (!path.startsWith('/admin')) return
  if (path === '/admin/login') return

  const token = req.cookies.get('admin_session')?.value
  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))

  try {
    await jwtVerify(token, SECRET)
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
