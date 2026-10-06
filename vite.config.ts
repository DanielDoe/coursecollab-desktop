import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'
import { codebenchDevPlugin } from './vite-plugins/codebench-dev'

function desktopApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    // Production middleware blocks unknown Origin headers on POST. The browser
    // sends Origin :5173 while the Vite shell proxies the API.
    cookieDomainRewrite: '',
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
      proxy.on('proxyRes', (proxyRes) => {
        const setCookie = proxyRes.headers['set-cookie']
        if (!setCookie) return
        proxyRes.headers['set-cookie'] = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(
          (cookie) =>
            cookie
              .replace(/;\s*Secure/gi, '')
              .replace(/;\s*Domain=[^;]*/gi, ''),
        )
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_API_URL || 'https://course-collab.com').replace(/\/+$/, '')
  // The desktop renderer is shipped to students. Only public build flags belong in the bundle.
  const processEnv: Record<string, string> = { NODE_ENV: mode }
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_') || key.startsWith('NEXT_PUBLIC_')) processEnv[key] = value
  }

  return {
    plugins: [react(), codebenchDevPlugin()],
    define: {
      'process.env': JSON.stringify(processEnv),
    },
    root: '.',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
        // Recharts imports decimal.js-light as CJS; Vite's prebundle interop can break
        // `new Decimal()` in tick math. Force the ESM build instead.
        'decimal.js-light': resolve(__dirname, 'node_modules/decimal.js-light/decimal.mjs'),
        'next/link': resolve(__dirname, 'src/shims/next-link.tsx'),
        'next/navigation': resolve(__dirname, 'src/shims/next-navigation.ts'),
        'next/image': resolve(__dirname, 'src/shims/next-image.tsx'),
        'next/script': resolve(__dirname, 'src/shims/next-script.tsx'),
        'next/dynamic': resolve(__dirname, 'src/shims/next-dynamic.tsx'),
        'next/headers': resolve(__dirname, 'src/shims/next-headers.ts'),
        '@vercel/analytics/next': resolve(__dirname, 'src/shims/vercel-analytics.tsx'),
        'next/font/google': resolve(__dirname, 'src/shims/next-font-google.ts'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        external: ['pg', '@neondatabase/serverless', 'bcryptjs', 'nodemailer'],
      },
    },
    optimizeDeps: {
      exclude: ['pg', '@neondatabase/serverless'],
      include: ['decimal.js-light', 'recharts', 'pdfjs-dist'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        // These routes exist in the local Next server. Production does not have them yet,
        // so the desktop shell would otherwise hide an open lobby.
        '/api/playground/open-lobbies': desktopApiProxy('http://127.0.0.1:3000'),
        '/api/playground/join': desktopApiProxy('http://127.0.0.1:3000'),
        '/api/playground/lobby': desktopApiProxy('http://127.0.0.1:3000'),
        '/api': desktopApiProxy(apiTarget),
      },
    },
  }
})
