"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2,
  Crown,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Palette,
  Shield,
  Sparkles,
  User,
  FileText,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { AppearanceSettingsPanel } from "@/components/appearance/AppearanceSettingsPanel"
import { MfaSecurityStatusCard } from "@/components/auth/MfaSecurityStatusCard"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getStudentAuthHeaders, getStudentData, logoutStudent, setStudentSession } from "@/lib/auth"
import { initialsFromName } from "@/lib/initials-from-name"
import { portalCta, portalInput, portalLabel } from "@/lib/appearance/portal-shell-theme"
import { guestOnboardingPurposeLabel } from "@/lib/guest/onboarding"
import { CAREER_MEMBER_LABEL, CAREER_MEMBER_PORTAL, CAREER_MEMBER_WORKSPACE } from "@/lib/guest/display"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { EMBED_INNER_PANEL, EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"
import { formatGuestAccessPrice, guestPlanHasCareerUnlock } from "@/lib/guest/membership-config"
import { GuestMasterResumePanel } from "@/components/guest/career/GuestMasterResumePanel"
import { PrivacySecurityPanel } from "@/components/compliance/PrivacySecurityPanel"

const theme = getGuestPortalTheme()

export type GuestSettingsSection = "profile" | "security" | "privacy" | "appearance" | "cora"

const SECTIONS: { id: GuestSettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Password & security", icon: Shield },
  { id: "privacy", label: "Privacy & legal", icon: Lock },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "cora", label: "Cora & credits", icon: Sparkles },
]

function parseSection(search: string | null, hash: string): GuestSettingsSection {
  if (search === "security" || search === "privacy" || search === "appearance" || search === "cora" || search === "profile") {
    return search
  }
  if (hash === "security" || hash === "privacy" || hash === "appearance" || hash === "cora" || hash === "profile") {
    return hash
  }
  return "profile"
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(EMBED_INNER_PANEL, "p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            theme.page.iconBg,
            theme.page.iconText,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--cc-text)]">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function CareerTile({
  href,
  icon: Icon,
  title,
  description,
  meta,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  meta?: string
}) {
  return (
    <Link href={href} className="group block min-w-0">
      <div
        className={cn(
          EMBED_INNER_PANEL,
          "flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--muted)]/50 sm:p-4",
        )}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            theme.page.iconBg,
            theme.page.iconText,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
          <p className="mt-0.5 text-xs text-[var(--cc-text-muted)] line-clamp-2">{description}</p>
          {meta ? <p className="mt-1 text-[11px] font-medium text-[var(--cc-accent-dark)]">{meta}</p> : null}
        </div>
      </div>
    </Link>
  )
}

export function GuestSettingsHub({ initialSection }: { initialSection?: GuestSettingsSection }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { entitlements } = useGuestDashboard()

  const section = initialSection ?? parseSection(searchParams.get("section"), "")

  const setSection = useCallback(
    (id: GuestSettingsSection) => {
      router.replace(id === "profile" ? "/guest/settings" : `/guest/settings?section=${id}`, {
        scroll: false,
      })
    },
    [router],
  )

  const [session, setSession] = useState<ReturnType<typeof getStudentData>>(null)
  const [loading, setLoading] = useState(true)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [organization, setOrganization] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId || !d.isPlatformGuest) {
      router.replace("/student/login/guest")
      return
    }
    setSession(d)
    setLoading(true)
    setProfileError("")
    try {
      const res = await fetch(`/api/guest/profile?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/student/login/guest")
          return
        }
        throw new Error(data.error || "Failed to load")
      }
      setFirstName(data.firstName ?? "")
      setLastName(data.lastName ?? "")
      setEmail(data.email ?? "")
      setOrganization(data.organization ?? "")
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash || searchParams.get("section")) return
    const mapped = parseSection(null, hash)
    if (mapped !== "profile") {
      router.replace(`/guest/settings?section=${mapped}`, { scroll: false })
    }
  }, [router, searchParams])

  const displayName = session?.name?.trim() || `${firstName} ${lastName}`.trim() || "Guest"
  const initials = useMemo(() => initialsFromName(displayName) || "G", [displayName])
  const hasCareer = guestPlanHasCareerUnlock(entitlements.plan)
  const creditsLabel =
    entitlements.credits != null ? `${entitlements.credits.toLocaleString()} credits` : undefined
  const studentDatabaseId = session?.databaseId ? Number(session.databaseId) : null

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const d = getStudentData()
    if (!d?.databaseId) return
    setProfileSaving(true)
    setProfileError("")
    setProfileSuccess(false)
    try {
      const res = await fetch("/api/guest/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: d.databaseId,
          firstName,
          lastName,
          email,
          organization,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      const fullName = String(data.fullName ?? `${firstName} ${lastName}`.trim())
      setStudentSession({
        id: d.id,
        name: fullName,
        section: d.section,
        databaseId: d.databaseId,
        isPlatformGuest: true,
        guestAccessPurpose: d.guestAccessPurpose,
      })
      setSession(getStudentData())
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setProfileSaving(false)
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault()
    const d = getStudentData()
    if (!d?.databaseId) return
    if (!currentPassword || !newPassword) {
      setPasswordError("Enter your current password and a new password.")
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("New passwords do not match.")
      return
    }
    setPasswordSaving(true)
    setPasswordError("")
    setPasswordSuccess("")
    try {
      const res = await fetch("/api/guest/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: d.databaseId,
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not change password")
      setCurrentPassword("")
      setNewPassword("")
      setNewPasswordConfirm("")
      setPasswordSuccess("Password updated.")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not change password")
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading || !session) {
    return (
      <div className="flex justify-center gap-2 py-12 text-sm text-[var(--cc-text-muted)]">
        <Loader2 className="size-4 animate-spin" />
        Loading settings…
      </div>
    )
  }

  const profilePanel = (
    <div className="space-y-4">
      <div className={cn(EMBED_MATERIAL_PANEL, "flex items-center gap-3 p-3.5 sm:p-4")}>
        <Avatar className="size-11 border border-[var(--border)]">
          <AvatarFallback className={cn("text-sm font-semibold", theme.page.iconBg, theme.page.iconText)}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--cc-text)]">{displayName}</p>
          <p className="text-xs text-[var(--cc-text-muted)]">
            {CAREER_MEMBER_LABEL} · {guestOnboardingPurposeLabel(session.guestAccessPurpose)}
            {session.id ? ` · ${session.id}` : ""}
          </p>
        </div>
      </div>

      <Panel icon={User} title="Profile" description="Name, email, and organization">
        <form onSubmit={onSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gs-fn" className={portalLabel}>
                First name
              </Label>
              <Input
                id="gs-fn"
                className={portalInput}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={profileSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gs-ln" className={portalLabel}>
                Last name
              </Label>
              <Input
                id="gs-ln"
                className={portalInput}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={profileSaving}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs-em" className={portalLabel}>
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <Input
                id="gs-em"
                type="email"
                className={cn(portalInput, "pl-10")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={profileSaving}
                autoComplete="email"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs-org" className={portalLabel}>
              Organization
            </Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <Input
                id="gs-org"
                className={cn(portalInput, "pl-10")}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                required
                disabled={profileSaving}
              />
            </div>
          </div>
          {profileError ? <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p> : null}
          {profileSuccess ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Profile saved.</p>
          ) : null}
          <Button type="submit" className={cn("rounded-xl", theme.page.cta)} disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Panel>
    </div>
  )

  const securityPanel = (
    <div className="space-y-4">
      {studentDatabaseId != null ? (
        <MfaSecurityStatusCard
          userType="student"
          userId={studentDatabaseId}
          accountName={email || undefined}
          issuer={CAREER_MEMBER_PORTAL}
        />
      ) : null}
      <Panel icon={KeyRound} title="Password" description="Update your sign-in password">
        <form onSubmit={onChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gs-cp" className={portalLabel}>
              Current password
            </Label>
            <Input
              id="gs-cp"
              type="password"
              className={portalInput}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordSaving}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs-np" className={portalLabel}>
              New password
            </Label>
            <Input
              id="gs-np"
              type="password"
              className={portalInput}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordSaving}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gs-np2" className={portalLabel}>
              Confirm new password
            </Label>
            <Input
              id="gs-np2"
              type="password"
              className={portalInput}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              disabled={passwordSaving}
              autoComplete="new-password"
            />
          </div>
          {passwordError ? <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p> : null}
          {passwordSuccess ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{passwordSuccess}</p>
          ) : null}
          <Button type="submit" className={cn("gap-2 rounded-xl", portalCta)} disabled={passwordSaving}>
            {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {passwordSaving ? "Updating…" : "Change password"}
          </Button>
        </form>
      </Panel>

      <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
        <p className="text-xs text-[var(--cc-text-muted)]">Sign out of your {CAREER_MEMBER_WORKSPACE} on this device.</p>
        <button
          type="button"
          onClick={() => logoutStudent(true)}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200/80 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 dark:border-red-900/40 dark:text-rose-400"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  const appearancePanel = (
    <Panel
      icon={Palette}
      title="Appearance & themes"
      description={`Themes and light / dark mode apply across your ${CAREER_MEMBER_WORKSPACE}`}
    >
      <AppearanceSettingsPanel />
    </Panel>
  )

  const coraPanel = (
    <div className="space-y-4">
      <Panel
        icon={FileText}
        title="Master résumé"
        description="Upload once — reused for quick scans, cover letters, recommendations, and Cora chat"
      >
        <GuestMasterResumePanel />
      </Panel>
      <Panel icon={Sparkles} title="Cora Career & credits" description={`Manage AI access for your ${CAREER_MEMBER_WORKSPACE}`}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <CareerTile
            href="/guest/cora-career/access"
            icon={Crown}
            title="Cora Career"
            description="Lifetime unlock for application AI tools"
            meta={
              hasCareer
                ? entitlements.plan === "cora_career"
                  ? "Lifetime access active"
                  : "Essentials active"
                : `From ${formatGuestAccessPrice("cora_career_essentials")}`
            }
          />
          <CareerTile
            href="/guest/cora-credits"
            icon={Sparkles}
            title="Cora Credits"
            description="Add consumable AI credits — never expire"
            meta={creditsLabel ?? (hasCareer ? undefined : "Requires Cora Career")}
          />
        </div>
      </Panel>
    </div>
  )

  const privacyPanel = (
    <Panel icon={Lock} title="Privacy & legal" description="Policy, Cora data, and account deletion">
      <PrivacySecurityPanel
        accountKind="guest"
        authHeaders={getStudentAuthHeaders()}
        onDeleted={() => logoutStudent(true)}
      />
    </Panel>
  )

  const content =
    section === "security"
      ? securityPanel
      : section === "privacy"
        ? privacyPanel
      : section === "appearance"
        ? appearancePanel
        : section === "cora"
          ? coraPanel
          : profilePanel

  return (
    <FacultyModuleSplitLayout
      className="lg:min-h-[min(520px,60vh)]"
      menuWidthClass="lg:w-56"
      menu={
        <FacultyModuleSideMenu
          embedded
          moduleId="settings"
          title="Browse"
          accent="theme"
          activeId={section}
          onSelect={(id) => setSection(id as GuestSettingsSection)}
          items={SECTIONS}
        />
      }
    >
      {content}
    </FacultyModuleSplitLayout>
  )
}
