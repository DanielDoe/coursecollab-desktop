/**
 * Local QA only: set NEXT_PUBLIC_DISABLE_QUIZ_ANTICHEAT=true in .env.local
 * to turn off Gemini detection, fullscreen enforcement, and violation auto-submit
 * while manually testing quiz flows in development.
 */
export function isQuizAntiCheatDisabledForTesting(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DISABLE_QUIZ_ANTICHEAT === "true"
  )
}
