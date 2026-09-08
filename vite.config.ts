import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'
import { codebenchDevPlugin } from './vite-plugins/codebench-dev'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_API_URL || 'https://course-collab.com').replace(/\/+$/, '')
  const processEnv = { NODE_ENV: mode, ...env }

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
      include: ['decimal.js-light', 'recharts'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // Production middleware blocks unknown Origin headers on POST. The browser
          // sends Origin :5173 while the Vite shell proxies to course-collab.com.
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
        },
      },
    },
  }
})
