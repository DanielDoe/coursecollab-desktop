export type CookiePurpose = "authentication" | "essential" | "preferences" | "analytics"

export type CookieRecord = {
  name: string
  provider: "coursecollab" | "vercel"
  purpose: CookiePurpose
  essential: boolean
  duration: string
  notes: string
}

export const COOKIE_INVENTORY: CookieRecord[] = [
  {
    name: "cc_refresh / refresh-token cookies",
    provider: "coursecollab",
    purpose: "authentication",
    essential: true,
    duration: "session / refresh lifetime",
    notes: "HttpOnly refresh cookies. Required to stay signed in.",
  },
  {
    name: "user timezone cookie",
    provider: "coursecollab",
    purpose: "preferences",
    essential: true,
    duration: "persistent preference",
    notes: "Stores display timezone. Not used for advertising.",
  },
]

export const BROWSER_STORAGE_INVENTORY = [
  { store: "localStorage", purpose: "theme, portal UI state, draft editors", essential: true },
  { store: "sessionStorage", purpose: "short-lived UI state", essential: true },
] as const

/**
 * Vercel Web Analytics is loaded unless NEXT_PUBLIC_DISABLE_VERCEL_ANALYTICS=true.
 * It is first-party and does not set advertising cookies. No consent banner is
 * shipped because there is no nonessential marketing pixel to gate.
 */
export const NONESSENTIAL_MARKETING_COOKIES = false
