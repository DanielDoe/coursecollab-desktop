/**
 * Global console override
 * Logs are ALWAYS enabled - never suppressed (for debugging production issues).
 * To suppress in production, set NEXT_PUBLIC_SUPPRESS_CONSOLE=true (currently disabled).
 */
const shouldSuppress = false // Never suppress - ensures Vercel function logs are visible

const isDevelopment =
  typeof process !== "undefined"
    ? process.env.NODE_ENV === "development"
    : typeof window !== "undefined"
      ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      : false

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

// Override console methods only when explicitly suppressing
if (shouldSuppress) {
  // Production with suppression: No-op functions
  console.log = () => {}
  console.warn = () => {}
  console.error = () => {}
  console.info = () => {}
  console.debug = () => {}
} else {
  // Development or production (testing): Use original methods - logs enabled
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.info = originalConsole.info
  console.debug = originalConsole.debug
}

// Export a function to check if logging is enabled (useful for conditional logging)
export const isLoggingEnabled = () => !shouldSuppress

// Export original console methods in case they're needed
export { originalConsole }
