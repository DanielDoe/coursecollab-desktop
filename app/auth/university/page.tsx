"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { UniversityLogo, universityHasFullWordmark } from "@/components/auth/UniversityLogo"
import { useRouter, useSearchParams } from "next/navigation"
import { DesktopAuthLoading } from "@/components/auth/DesktopAuthLoading"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { DesktopAuthBackLink, DesktopAuthPanel, DesktopAuthPanelBody, DesktopAuthPanelCard, desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { DesktopAuthStagger, useDesktopAuthMotion } from "@/components/auth/desktop-auth-motion"
import { useAuth } from "@/lib/auth-context"
import { isOtherUniversity, type UniversityRecord } from "@/lib/universities-shared"
import { readRememberedUniversity } from "@/lib/remembered-auth"
import { cn } from "@/lib/utils"
import { ChevronRight, Search } from "lucide-react"
import { useRememberedStudentAuthRedirect } from "@/components/auth/useRememberedStudentAuthRedirect"
import { useRememberedFacultyAuthRedirect } from "@/components/auth/useRememberedFacultyAuthRedirect"
import { isDesktopLoginOnlyShell, openWebAppPath, DESKTOP_WEB_SIGNUP_PATHS } from "@/lib/desktop-auth-policy"

function UniversityOptionButton({
  uni,
  active,
  onSelect,
  isLast,
  index = 0,
}: {
  uni: UniversityRecord
  active: boolean
  onSelect: () => void
  isLast?: boolean
  index?: number
}) {
  const { item, reduceMotion } = useDesktopAuthMotion()

  return (
    <motion.button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...item, delay: reduceMotion ? 0 : index * 0.04 }}
      className={cn(
        "cc-desktop-welcome-row flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
        active
          ? "bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--cc-surface))]"
          : "hover:bg-[var(--cc-accent-soft)] active:bg-[color-mix(in_srgb,var(--cc-accent-soft)_70%,var(--cc-surface))]",
        !isLast && "border-b border-[var(--border)]",
      )}
      style={
        active
          ? {
              background: `color-mix(in srgb, ${uni.primary_color} 10%, var(--cc-surface))`,
            }
          : undefined
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <UniversityLogo university={uni} size="sm" variant="compact" />
      </span>
      <span className="min-w-0 flex-1">
        {!universityHasFullWordmark(uni) && !isOtherUniversity(uni) ? (
          <span
            className="mb-0.5 inline-block text-[10px] font-bold uppercase tracking-widest"
            style={{ color: uni.primary_color }}
          >
            {uni.short_name}
          </span>
        ) : null}
        <span className="block truncate text-[13px] font-medium text-[var(--cc-text)]">{uni.name}</span>
        {isOtherUniversity(uni) ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--cc-text-secondary)]">
            Independent, company, or school not listed
          </span>
        ) : uni.domain ? (
          <span className="mt-0.5 block truncate text-[12px] text-[var(--cc-text-secondary)]">
            {uni.domain}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-current" : "border-[var(--border)]",
        )}
        style={active ? { borderColor: uni.primary_color, color: uni.primary_color } : undefined}
      >
        {active ? (
          <span className="h-2 w-2 rounded-full" style={{ background: uni.primary_color }} />
        ) : null}
      </span>
    </motion.button>
  )
}

export default function AuthUniversityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setSelectedUniversity } = useAuth()
  const [universities, setUniversities] = useState<UniversityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UniversityRecord[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<UniversityRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const isFacultyFlow = searchParams.get("next") === "faculty"

  useRememberedStudentAuthRedirect()
  useRememberedFacultyAuthRedirect()

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/universities")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load universities")
        setUniversities(data.universities ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load universities")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading || selected) return
    const remembered = readRememberedUniversity()
    if (!remembered) return
    const match = universities.find((u) => u.id === remembered.id)
    setSelected(match ?? remembered)
  }, [loading, universities, selected])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const res = await fetch(`/api/auth/universities/search?q=${encodeURIComponent(q)}`)
          const data = await res.json()
          setResults(Array.isArray(data.universities) ? data.universities : [])
        } catch {
          setResults([])
        } finally {
          setSearching(false)
        }
      })()
    }, 280)
    return () => window.clearTimeout(handle)
  }, [query])

  const featured = useMemo(
    () => universities.filter((u) => !isOtherUniversity(u)),
    [universities],
  )

  const rememberedOutsideFeatured = useMemo(() => {
    if (!selected?.id || isOtherUniversity(selected)) return null
    if (featured.some((u) => u.id === selected.id)) return null
    return selected
  }, [selected, featured])

  const other = useMemo(
    () => universities.find((u) => isOtherUniversity(u)) ?? null,
    [universities],
  )

  const showingSearch = query.trim().length >= 2

  const listItems = useMemo(() => {
    if (showingSearch) {
      return results.map((uni) => ({
        key: `${uni.id}-${uni.domain ?? uni.name}`,
        uni,
        active:
          selected?.id === uni.id && uni.id > 0
            ? true
            : Boolean(
                selected &&
                  selected.id === 0 &&
                  selected.name === uni.name &&
                  selected.domain === uni.domain,
              ),
      }))
    }

    const items: { key: string; uni: UniversityRecord; active: boolean }[] = []
    if (rememberedOutsideFeatured) {
      items.push({
        key: `remembered-${rememberedOutsideFeatured.id}`,
        uni: rememberedOutsideFeatured,
        active: selected?.id === rememberedOutsideFeatured.id,
      })
    }
    for (const uni of featured) {
      items.push({
        key: String(uni.id),
        uni,
        active: selected?.id === uni.id,
      })
    }
    if (other) {
      items.push({
        key: "other",
        uni: other,
        active: Boolean(selected && isOtherUniversity(selected)),
      })
    }
    return items
  }, [
    showingSearch,
    results,
    selected,
    rememberedOutsideFeatured,
    featured,
    other,
  ])

  const handleContinue = async () => {
    if (!selected) return
    setSaving(true)
    setError("")
    try {
      let university = selected
      if (!university.id) {
        const res = await fetch("/api/auth/universities/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: university.name,
            domain: university.domain,
            shortName: university.short_name,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.university) throw new Error(data.error || "Could not save school")
        university = data.university as UniversityRecord
      }
      setSelectedUniversity(university)
      if (searchParams.get("next") === "faculty") {
        router.push("/faculty/login")
      } else if (searchParams.get("next") === "signup") {
        if (isDesktopLoginOnlyShell()) {
          openWebAppPath(DESKTOP_WEB_SIGNUP_PATHS.student)
          router.push("/auth/welcome")
        } else {
          router.push("/auth/student/signup")
        }
      } else {
        router.push("/auth/student")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DesktopAuthShell
      sidebarTagline={
        isFacultyFlow
          ? "Select your institution to continue to faculty sign-in."
          : "Find your school to access courses, assignments, and AI tools."
      }
    >
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard>
            <DesktopAuthStagger className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className={desktopAuth.title}>
              {isFacultyFlow ? "Choose your institution" : "Choose your university"}
            </h1>
            <p className={desktopAuth.subtitle}>
              Search schools, or pick Other if yours is not listed.
            </p>
          </div>

          {loading ? (
            <DesktopAuthLoading label="Loading universities" compact />
          ) : error && universities.length === 0 ? (
            <p className="text-sm text-[var(--cc-danger)]">{error}</p>
          ) : (
            <div className="space-y-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search universities…"
                  className={cn(desktopAuth.input, "w-full pl-9 pr-9")}
                  autoComplete="off"
                />
                {searching ? (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <CcBookLoader size="xs" label="Searching universities" />
                  </div>
                ) : null}
              </label>

              <div
                className="max-h-[min(20rem,46dvh)] overflow-hidden overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--cc-background)]"
                role="listbox"
                aria-label="Universities"
              >
                {showingSearch && results.length === 0 && !searching ? (
                  <p className="px-4 py-6 text-center text-[13px] text-[var(--cc-text-secondary)]">
                    No matches. Choose Other below.
                  </p>
                ) : (
                  listItems.map(({ key, uni, active }, index) => (
                    <UniversityOptionButton
                      key={key}
                      uni={uni}
                      active={active}
                      index={index}
                      isLast={index === listItems.length - 1}
                      onSelect={() => setSelected(uni)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {error && universities.length > 0 ? (
            <p className="text-sm text-[var(--cc-danger)]">{error}</p>
          ) : null}

          <div className={desktopAuth.actionStack}>
            <button
              type="button"
              disabled={!selected || saving}
              onClick={() => void handleContinue()}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 active:enabled:scale-[0.995]"
              style={{
                backgroundColor: selected?.primary_color ?? "var(--cc-accent)",
              }}
            >
              {saving ? (
                <>
                  <CcBookLoader size="xs" label="Saving university" className="mr-1" />
                  Saving…
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
                </>
              )}
            </button>
            <DesktopAuthBackLink href="/auth/welcome" className="mt-0" />
          </div>
          </DesktopAuthStagger>
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
