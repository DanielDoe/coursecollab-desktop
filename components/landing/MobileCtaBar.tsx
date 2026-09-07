"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Sparkles } from "lucide-react"

/** Scroll distance (px) after which the bar slides in — roughly past the hero CTAs. */
const REVEAL_AFTER = 520

/**
 * Persistent bottom action bar for phones only.
 *
 * The landing page is long on mobile, so the hero's Student/Faculty entry points
 * scroll away quickly. This keeps both within thumb reach for the whole page.
 * Hidden from `md` up, where the sticky header already carries the same links.
 */
export function MobileCtaBar() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    // Set state straight from the passive handler rather than batching through
    // requestAnimationFrame. rAF is suspended while the tab is hidden, and a
    // scroll event arriving in that window would latch an "update pending"
    // guard that never clears — leaving the bar frozen for the rest of the
    // session. Setting a boolean React already bails out on is cheap enough
    // that the coalescing bought nothing.
    const onScroll = () => setVisible(window.scrollY > REVEAL_AFTER)

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-background)_92%,transparent)] backdrop-blur-xl transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 px-4 py-2.5">
        <Link
          href="/student/login"
          prefetch={false}
          tabIndex={visible ? undefined : -1}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--cc-accent-dark)] px-3 text-sm font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Student login
        </Link>
        <Link
          href="/faculty/login"
          prefetch={false}
          tabIndex={visible ? undefined : -1}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1 rounded-full border-2 border-[var(--cc-accent)] bg-[var(--cc-surface)] px-3 text-sm font-semibold text-[var(--cc-accent)] active:scale-[0.98]"
        >
          Faculty
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
