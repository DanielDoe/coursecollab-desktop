import { app, net, protocol, session, type Session } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'

export const APP_PROTOCOL_SCHEME = 'app'
export const APP_PROTOCOL_HOST = 'localhost'

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export function usePackagedRenderer(): boolean {
  return app.isPackaged || process.env.CC_PACKAGED_PREVIEW === '1'
}

export function getAppOrigin(): string {
  return `${APP_PROTOCOL_SCHEME}://${APP_PROTOCOL_HOST}`
}

export function resolvePackagedApiOrigin(): string {
  const raw =
    process.env.VITE_API_URL?.trim() ||
    process.env.COURSECOLLAB_URL?.trim() ||
    'https://course-collab.com'
  return raw.replace(/\/+$/, '')
}

/** Must run before `app.ready` so Chromium treats `app://` like a real origin. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

function distRoot(): string {
  return normalize(join(__dirname, '../dist'))
}

function isInsideDist(filePath: string): boolean {
  const root = distRoot()
  const resolved = normalize(filePath)
  return resolved === root || resolved.startsWith(`${root}${sep}`)
}

function rewriteProxyCookies(headers: Headers): Headers {
  const next = new Headers(headers)
  const cookies = typeof next.getSetCookie === 'function' ? next.getSetCookie() : []
  if (cookies.length === 0) return next

  next.delete('set-cookie')
  for (const cookie of cookies) {
    next.append(
      'set-cookie',
      cookie.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, ''),
    )
  }
  return next
}

async function serveDistFile(pathname: string): Promise<Response> {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '')
  const requested = normalize(join(distRoot(), relative))
  const hasExtension = Boolean(extname(pathname))
  const filePath =
    hasExtension && isInsideDist(requested) && existsSync(requested)
      ? requested
      : join(distRoot(), 'index.html')

  if (!isInsideDist(filePath) || !existsSync(filePath)) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
  }

  const data = await readFile(filePath)
  return new Response(data, {
    headers: {
      'content-type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    },
  })
}

async function proxyApiRequest(request: Request, url: URL): Promise<Response> {
  const dest = `${resolvePackagedApiOrigin()}${url.pathname}${url.search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('origin')
  headers.delete('referer')

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  const response = await net.fetch(dest, {
    ...init,
    bypassCustomProtocolHandlers: true,
  })
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: rewriteProxyCookies(response.headers),
  })
}

export function registerAppProtocol(targetSession: Session = session.defaultSession): void {
  if (targetSession.protocol.isProtocolHandled(APP_PROTOCOL_SCHEME)) return

  targetSession.protocol.handle(APP_PROTOCOL_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/')) {
        return await proxyApiRequest(request, url)
      }
      return await serveDistFile(url.pathname)
    } catch (error) {
      console.error('[desktop] app protocol failed', request.url, error)
      return new Response('Desktop shell failed to load', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      })
    }
  })
}
