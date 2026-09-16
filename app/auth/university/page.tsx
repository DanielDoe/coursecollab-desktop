"use client"

import { useEffect, useMemo, useState } from "react"
import { UniversityLogo, universityHasFullWordmark } from "@/components/auth/UniversityLogo"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { useAuth } from "@/lib/auth-context"
import { isOtherUniversity, type UniversityRecord } from "@/lib/universities-shared"
import { readRememberedUniversity } from "@/lib/remembered-auth"
import { cn } from "@/lib/utils"
import { Loader2, Search } from "lucide-react"
import { useRememberedStudentAuthRedirect } from "@/components/auth/useRememberedStudentAuthRedirect"
import { useRememberedFacultyAuthRedirect } from "@/components/auth/useRememberedFacultyAuthRedirect"

function UniversityOptionButton({
  uni,
  active,
  onSelect,
}: {
  uni: UniversityRecord
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all",
        active
          ? "shadow-sm"
          : "border-[var(--border)] bg-[var(--cc-surface)] hover:border-[color-mix(in_srgb,var(--cc-accent)_28%,var(--border))] hover:bg-[var(--cc-accent-soft)]",
      )}
      style={
        active
          ? {
              borderColor: uni.primary_color,
              background: `color-mix(in srgb, ${uni.primary_color} 14%, var(--cc-surface))`,
            }
          : undefined
      }
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center">
        <UniversityLogo university={uni} size="sm" variant="compact" />
      </span>
      <span className="min-w-0 flex-1">
        {!universityHasFullWordmark(uni) && !isOtherUniversity(uni) ? (
          <span
            className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: uni.primary_color, backgroundColor: `${uni.primary_color}18` }}
          >
            {uni.short_name}
          </span>
        ) : null}
        <span className="block truncate font-semibold text-[var(--cc-text)]">{uni.name}</span>
        {isOtherUniversity(uni) ? (
          <span className="mt-0.5 block text-xs text-[var(--cc-text-secondary)]">
            Independent, company, or school not listed
          </span>
        ) : uni.domain ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--cc-text-secondary)]">{uni.domain}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          active ? "border-current" : "border-[var(--border)]",
        )}
        style={active ? { borderColor: uni.primary_color, color: uni.primary_color } : undefined}
      >
        {active ? (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: uni.primary_color }} />
        ) : null}
      </span>
    </button>
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
        router.push("/auth/student/signup")
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
    <AuthShell backHref="/">
      <AuthGlassCard className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-[var(--cc-text)]">Choose Your University</h1>
          <p className="text-sm text-[var(--cc-text-secondary)]">
            Search thousands of schools, or pick Other if yours is not listed.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          </div>
        ) : error && universities.length === 0 ? (
          <p className="text-center text-sm text-[var(--cc-danger)]">{error}</p>
        ) : (
          <div className="space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search universities…"
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] pl-10 pr-10 text-sm text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-muted)] focus:border-[var(--cc-accent)]"
                autoComplete="off"
              />
              {searching ? (
                <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--cc-accent)]" />
              ) : null}
            </label>

            <div className="max-h-[min(24rem,52vh)] space-y-2 overflow-y-auto pr-0.5" role="listbox" aria-label="Universities">
              {showingSearch ? (
                results.length === 0 && !searching ? (
                  <p className="px-1 py-3 text-center text-sm text-[var(--cc-text-secondary)]">
                    No matches. Choose Other below.
                  </p>
                ) : (
                  results.map((uni) => (
                    <UniversityOptionButton
                      key={`${uni.id}-${uni.domain ?? uni.name}`}
                      uni={uni}
                      active={
                        selected?.id === uni.id && uni.id > 0
                          ? true
                          : Boolean(selected && selected.id === 0 && selected.name === uni.name && selected.domain === uni.domain)
                      }
                      onSelect={() => setSelected(uni)}
                    />
                  ))
                )
              ) : (
                <>
                  {rememberedOutsideFeatured ? (
                    <UniversityOptionButton
                      key={`remembered-${rememberedOutsideFeatured.id}`}
                      uni={rememberedOutsideFeatured}
                      active={selected?.id === rememberedOutsideFeatured.id}
                      onSelect={() => setSelected(rememberedOutsideFeatured)}
                    />
                  ) : null}
                  {featured.map((uni) => (
                    <UniversityOptionButton
                      key={uni.id}
                      uni={uni}
                      active={selected?.id === uni.id}
                      onSelect={() => setSelected(uni)}
                    />
                  ))}
                </>
              )}
              {other ? (
                <UniversityOptionButton
                  uni={other}
                  active={Boolean(selected && isOtherUniversity(selected))}
                  onSelect={() => setSelected(other)}
                />
              ) : null}
            </div>
          </div>
        )}

        {error && universities.length > 0 ? (
          <p className="text-center text-sm text-[var(--cc-danger)]">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={!selected || saving}
          onClick={() => void handleContinue()}
          className="h-12 w-full rounded-2xl font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: selected?.primary_color ?? "var(--cc-accent)",
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>

        <p className="text-center text-xs text-[var(--cc-text-secondary)]">
          Platform admin?{" "}
          <Link
            href="/admin/login"
            className="font-medium text-[var(--cc-accent)] hover:text-[var(--cc-accent-dark)] hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </AuthGlassCard>
    </AuthShell>
  )
}
