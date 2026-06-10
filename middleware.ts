import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // /api/fonts/ は認証不要
  if (request.nextUrl.pathname.startsWith('/api/fonts/')) {
    return NextResponse.next()
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/fonts/:path*'],
}
