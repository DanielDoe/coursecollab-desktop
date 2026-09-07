// Import console override early to disable logs in production
import '@/lib/console-override'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { classicStudentModuleRedirect } from '@/lib/student-v2-routes'
import { isNativeAppUserAgent, NATIVE_LOGIN_PATH } from '@/lib/mobile-native-app'
import { corsAllowOriginValue, isBlockedCrossOriginMutation } from '@/lib/security/cors'

/**
 * AI Bot User-Agent Blocking Middleware
 * 
 * Blocks known AI crawlers and browser extensions from accessing quiz content.
 * This prevents AI tools from scraping quiz questions when students paste URLs.
 */
const BANNED_AGENTS = [
  'Google-Extended',
  'GPTBot',
  'CCBot',
  'PerplexityBot',
  'anthropic-ai',
  'Claude-Web',
  'ChatGPT-User',
  'Google-Extended',
  'Bingbot',
  'anthropic-ai',
  'ClaudeBot',
  'cohere-ai',
  'PerplexityBot',
  'YouBot',
  'SemrushBot',
  'AhrefsBot',
  'MJ12bot',
  'DotBot',
  'Baiduspider',
  'YandexBot',
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Slackbot',
  'Discordbot',
  'SkypeUriPreview',
  'Applebot',
  'ia_archiver',
  'archive.org_bot',
  'Wayback',
  'HeadlessChrome',
  'PhantomJS',
  'Selenium',
  'Puppeteer',
  'Playwright',
]

/**
 * Protected routes that should block AI bots
 */
const PROTECTED_ROUTES = [
  '/student/quiz/',
  '/student/homework/',
  '/student/midsem/',
  '/student/final/',
  '/student/[assessmentType]/report/',
  '/quizzes/',
  '/api/quiz/',
]

export function middleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''
  const pathname = request.nextUrl.pathname
  const origin = request.headers.get('origin')

  if (pathname.startsWith('/api/') && isBlockedCrossOriginMutation(request.method, origin)) {
    return new NextResponse(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }


  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev')) {
    return new NextResponse(null, { status: 404 })
  }

  const v2Redirect = classicStudentModuleRedirect(pathname)
  if (v2Redirect) {
    const url = request.nextUrl.clone()
    url.pathname = v2Redirect
    return NextResponse.redirect(url)
  }

  if (isNativeAppUserAgent(userAgent) && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = NATIVE_LOGIN_PATH.split('?')[0]
    url.search = NATIVE_LOGIN_PATH.split('?')[1] ?? ''
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()
  const allowedOrigin = corsAllowOriginValue(origin)
  if (allowedOrigin && pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-cc-refresh, x-cc-mfa-trust',
    )
    response.headers.set('Vary', 'Origin')
  }
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: response.headers })
  }
  if (isNativeAppUserAgent(userAgent)) {
    response.cookies.set('cc_native_app', '1', { path: '/', sameSite: 'lax' })
  }

  const isProtectedRoute = PROTECTED_ROUTES.some(route => {
    if (route.includes('[')) {
      const pattern = route.replace(/\[.*?\]/g, '[^/]+')
      const regex = new RegExp(`^${pattern}`)
      return regex.test(pathname)
    }
    return pathname.startsWith(route)
  })

  if (isProtectedRoute) {
    // Check if user-agent matches any banned agent
    const isBannedAgent = BANNED_AGENTS.some(agent => 
      userAgent.includes(agent)
    )

    if (isBannedAgent) {
      console.warn(`[AI Bot Blocked] ${userAgent} attempted to access ${pathname}`)
      return new NextResponse('AI Access Denied', { 
        status: 403,
        headers: {
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        }
      })
    }

    const protectedResponse = NextResponse.next()
    if (isNativeAppUserAgent(userAgent)) {
      protectedResponse.cookies.set('cc_native_app', '1', { path: '/', sameSite: 'lax' })
    }
    protectedResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet')
    return protectedResponse
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
