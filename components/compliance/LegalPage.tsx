import type { ReactNode } from "react"
import Link from "next/link"
import { LEGAL_LINKS } from "@/lib/compliance/legal"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[var(--background)] px-4 py-10 text-[var(--cc-text)] sm:px-6 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]">
        CourseCollab
      </p>
      <h1 className={`mt-2 text-3xl font-semibold tracking-tight ${PORTAL_TEXT}`}>{title}</h1>
      <p className={`mt-2 text-sm ${PORTAL_TEXT_MUTED}`}>Last updated {updated}</p>
      <article className="prose prose-slate dark:prose-invert prose-headings:text-[var(--cc-text)] prose-p:text-[var(--cc-text-secondary)] prose-li:text-[var(--cc-text-secondary)] prose-a:text-[var(--cc-accent-dark)] dark:prose-a:text-[var(--cc-accent)] mt-8 max-w-none text-sm leading-6">
        {children}
      </article>
      <nav className="mt-10 flex flex-wrap gap-4 border-t border-[var(--border)] pt-6 text-sm">
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[var(--cc-accent-dark)] underline-offset-4 hover:underline dark:text-[var(--cc-accent)]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </main>
  )
}
