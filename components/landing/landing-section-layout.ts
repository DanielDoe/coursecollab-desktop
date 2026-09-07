/** Shared landing layout + appearance theme tokens (--cc-* from AppearanceProvider) */

export const LANDING_LILAC = "var(--cc-background)"
export const LANDING_LILAC_HERO = "var(--cc-background)"

/**
 * Page shell.
 *
 * `cc-brand-surface` pins the --cc-* token surface to PVAMU purple + gold so
 * the public page looks identical for every visitor, whatever theme they have
 * saved in the app. Light/dark still follows the OS. See globals.css.
 */
export const landingPageClass =
  "cc-brand-surface landing-themed min-h-screen bg-[var(--cc-background)] text-[var(--cc-text)] antialiased overflow-x-hidden"

/** Aligned content width — hero, header, and sections share the same horizontal grid */
export const landingShellClass =
  "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8"

export const landingSectionClass =
  "relative scroll-mt-20 overflow-hidden bg-[var(--cc-background)] sm:scroll-mt-24"

export const landingSectionBelowFoldClass = ""

/** Phones get a tighter rhythm — 14 units per section makes the mobile page needlessly long. */
export const landingSectionInnerClass = `${landingShellClass} py-10 sm:py-20`

export const landingSectionHeaderClass = "mx-auto mb-6 max-w-2xl text-center sm:mb-14"

export const landingEyebrowClass =
  "mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-[var(--cc-accent)] shadow-sm"

export const landingSectionTitleClass =
  "mb-2 text-[1.5rem] font-extrabold leading-[1.15] tracking-tight text-[var(--cc-text)] sm:mb-3 sm:text-3xl sm:leading-tight md:text-4xl"

export const landingSectionDescClass =
  "mx-auto max-w-2xl text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:mt-3 sm:text-base md:text-lg"

/** Visible card chrome on themed backgrounds */
export const landingCardClass =
  "rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text)] shadow-[0_8px_30px_-12px_rgba(15,23,42,0.10)] dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]"

export const landingCardInteractiveClass = "transition-transform duration-200 hover:-translate-y-1"

export const landingAccentGradientClass =
  "bg-gradient-to-br from-[color-mix(in_srgb,var(--cc-accent)_88%,white)] to-[var(--cc-accent)] text-white"

export const landingPrimaryButtonClass =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[var(--cc-accent-dark)] px-7 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98] sm:py-3.5 sm:text-[15px]"

export const landingSecondaryButtonClass =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border-2 border-[var(--cc-accent)] bg-[var(--cc-surface)] px-7 py-3 text-sm font-semibold text-[var(--cc-accent)] shadow-sm transition-transform hover:scale-[1.03] hover:bg-[var(--cc-accent-soft)] active:scale-[0.98] sm:py-3.5 sm:text-[15px]"

export const landingFooterClass = "landing-footer relative z-10 mt-0 border-t border-white/10"

/** Solid lilac — use instead of bg images on phone */
export const landingMobileSolidBgClass =
  "pointer-events-none absolute inset-0 bg-[var(--cc-background)] md:hidden"

export const landingGradientFadeClass = "pointer-events-none absolute inset-x-0 h-32 sm:h-40"

export const landingGradientHandoffClass = "pointer-events-none absolute inset-x-0 h-48 sm:h-64"

export const landingGradientTopStyle = (from = LANDING_LILAC) => ({
  background: `linear-gradient(to bottom, ${from} 0%, color-mix(in srgb, ${from} 88%, transparent) 55%, transparent 100%)`,
})

export const landingGradientTopSoftStyle = () => ({
  background:
    "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--cc-background) 45%, transparent) 35%, color-mix(in srgb, var(--cc-background) 82%, transparent) 70%, transparent 100%)",
})

export const landingGradientBottomStyle = (to = LANDING_LILAC) => ({
  background: `linear-gradient(to top, ${to} 0%, color-mix(in srgb, ${to} 72%, transparent) 55%, transparent 100%)`,
})

export const landingGradientBottomHandoffStyle = (to = LANDING_LILAC) => ({
  background: `linear-gradient(to top, ${to} 0%, ${to} 18%, color-mix(in srgb, ${to} 92%, transparent) 52%, color-mix(in srgb, ${to} 50%, transparent) 78%, transparent 100%)`,
})

/** Hash links on marketing chrome. Off-homepage they must hit the landing page (or institution prices). */
export function landingHashHref(pathname: string, href: string): string {
  if (!href.startsWith("#")) return href
  if (pathname === "/") return href
  if (href === "#pricing" && pathname.startsWith("/institutions")) {
    return "/institutions#pricing"
  }
  return `/${href}`
}

export const landingSectionImageRevealMask = {
  WebkitMaskImage:
    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 16%, rgba(0,0,0,0.65) 32%, black 48%, black 100%)",
  maskImage:
    "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.25) 16%, rgba(0,0,0,0.65) 32%, black 48%, black 100%)",
}
