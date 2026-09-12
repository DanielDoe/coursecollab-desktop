/** @type {import('next').NextConfig} */
const nextConfig = {
  // Heavy local dev (e.g. many bulk re-evaluate API calls): if the dev server restarts with
  // "approaching the used memory threshold", run: NODE_OPTIONS="--max-old-space-size=8192" npm run dev

  // Optimize for production builds
  reactStrictMode: true,

  // Native WebView + simulator fetches during local dev
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.230", "10.0.2.2"],

  // Allow more time for static page generation (default 60s)
  staticPageGenerationTimeout: 300,

  // Performance optimizations
  productionBrowserSourceMaps: false,

  experimental: {
    // Custom webpack config disables the default worker; re-enable to lower peak RSS on Vercel.
    // Worker spawns extra Node processes; disable on Vercel to avoid 16 GB OOM during compile.
    webpackBuildWorker: process.env.VERCEL !== "1",
    cpus: process.env.VERCEL === "1" ? 1 : process.env.CI ? 2 : 4,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion',
      'recharts',
      'date-fns',
      'react-syntax-highlighter',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-table',
      '@tiptap/extension-link',
      '@tiptap/extension-placeholder',
      '@uiw/react-codemirror',
      '@tanstack/react-query',
    ],
    staticGenerationRetryCount: 2,
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
    turbo: {
      // Match webpack client alias (canvas is server-only via @napi-rs/canvas)
      resolveAlias: {
        canvas: { browser: './lib/dev-stubs/empty-module.js' },
      },
    },
  },
  
  // Compilation and build settings
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ESLint settings
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Image optimization
  images: {
    unoptimized: true,
  },
  
  // Externalize native/heavy deps — must NOT exclude linux canvas binaries from traces (Vercel runs Linux).
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist', 'heic-convert'],

  // Prevent local public/ assets from being traced into API lambdas.
  outputFileTracingExcludes: {
    '/**': [
      './public/**',
      'public/**',
      'node_modules/@napi-rs/canvas-darwin-*/**',
      'node_modules/@napi-rs/canvas-win32-*/**',
      'node_modules/monaco-editor/**',
      'node_modules/@swc/core-linux-*/**',
      'node_modules/@esbuild/**',
    ],
    '*': [
      './public/**',
      'public/**',
      'node_modules/@napi-rs/canvas-darwin-*/**',
      'node_modules/@napi-rs/canvas-win32-*/**',
      'node_modules/monaco-editor/**',
      'node_modules/@swc/core-linux-*/**',
      'node_modules/@esbuild/**',
    ],
  },

  // PDF rasterization needs worker + standard fonts at runtime when pdfjs-dist is externalized.
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/pdfjs-dist/standard_fonts/**',
      './node_modules/pdfjs-dist/cmaps/**',
      './node_modules/@napi-rs/canvas-linux-*/**',
    ],
  },
  
  // Compiler options - remove console.log in production (keep error, warn for critical issues)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Webpack optimizations
  async redirects() {
    return [
      { source: "/instructor/login", destination: "/faculty/login", permanent: false },
      { source: "/instructor/select-course", destination: "/faculty/select-course", permanent: false },
      { source: "/instructor/dashboard-v2", destination: "/faculty/dashboard", permanent: false },
      { source: "/instructor/dashboard-v2/:path*", destination: "/faculty/dashboard/:path*", permanent: false },
      { source: "/instructor/dashboard", destination: "/faculty/dashboard", permanent: false },
      { source: "/instructor/ai-monitoring", destination: "/faculty/dashboard/analytics/cora-insights", permanent: false },
      { source: "/instructor/grades", destination: "/faculty/dashboard/assessments/grades", permanent: false },
      { source: "/instructor/ai-insights", destination: "/faculty/dashboard/analytics/cora-insights", permanent: false },
      { source: "/faculty/dashboard/analytics/ai-monitoring", destination: "/faculty/dashboard/analytics/cora-insights", permanent: false },
      { source: "/faculty/dashboard/analytics/ai-insights", destination: "/faculty/dashboard/analytics/cora-insights", permanent: false },
      { source: "/instructor/issues", destination: "/faculty/dashboard/assessments/quizzes/issues", permanent: false },
      { source: "/faculty/dashboard/course-info/syllabus", destination: "/faculty/dashboard/content/syllabus", permanent: false },
      { source: "/instructor/dashboard-v2/course-info/syllabus", destination: "/instructor/dashboard-v2/content/syllabus", permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      { source: "/faculty/dashboard", destination: "/instructor/dashboard-v2" },
      { source: "/faculty/dashboard/:path*", destination: "/instructor/dashboard-v2/:path*" },
    ]
  },
  webpack: (config, { isServer, dev }) => {
    if (dev && config.cache && typeof config.cache === 'object') {
      // Prevent multi-GB webpack filesystem cache during long dev sessions
      config.cache.maxMemoryGenerations = 1
    }
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      }
    }
    // Production only: keep async vendor code split. A single minified vendors
    // chunk is slow to parse and one stale hash 404s the whole app after deploy.
    if (!isServer && !dev && config.optimization?.splitChunks && typeof config.optimization.splitChunks === "object") {
      const split = config.optimization.splitChunks
      config.optimization.splitChunks = {
        ...split,
        maxAsyncRequests: 30,
        cacheGroups: {
          ...(typeof split.cacheGroups === "object" ? split.cacheGroups : {}),
          monaco: {
            test: /[\\/]node_modules[\\/](monaco-editor|@monaco-editor)[\\/]/,
            name: "monaco",
            chunks: "async",
            priority: 50,
            reuseExistingChunk: true,
          },
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/,
            name: "charts",
            chunks: "async",
            priority: 45,
            reuseExistingChunk: true,
          },
          editor: {
            test: /[\\/]node_modules[\\/](@tiptap|@uiw[\\/]react-codemirror|@codemirror)[\\/]/,
            name: "editor",
            chunks: "async",
            priority: 40,
            reuseExistingChunk: true,
          },
        },
      }
    }
    return config
  },
}

export default nextConfig
