"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Bell,
  CheckCircle2,
  HelpCircle,
  History,
  Key,
  Shield,
  Loader2,
  Lock,
  Palette,
  RefreshCw,
  Save,
  User,
  UserCircle,
  Calendar,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { AppearanceSettingsPanel } from "@/components/appearance/AppearanceSettingsPanel"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { MfaSecurityStatusCard } from "@/components/auth/MfaSecurityStatusCard"
import { readFacultySession } from "@/lib/faculty-auth-flow"
import { CoraUsageHistory } from "@/components/cora/CoraUsageHistory"
import { PrivacySecurityPanel } from "@/components/compliance/PrivacySecurityPanel"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { logoutFaculty } from "@/lib/faculty-auth-flow"

export type FacultySettingsSection = "account" | "appearance" | "preferences" | "privacy" | "help" | "cora-usage"

const SECTIONS: { id: FacultySettingsSection; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "preferences", label: "Preferences", icon: Bell },
  { id: "privacy", label: "Privacy & legal", icon: Shield },
  { id: "cora-usage", label: "Cora history", icon: History },
  { id: "help", label: "Help", icon: HelpCircle },
]

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

interface InstructorProfile {
  id: number
  username: string
  email: string
  name: string
  created_at: string
  last_login: string | null
}

interface SettingsData {
  preferences: {
    theme: "light" | "dark" | "system"
    notifications: boolean
    email_notifications: boolean
    auto_save: boolean
  }
  security: {
    two_factor_enabled: boolean
    session_timeout: number
    password_change_required: boolean
  }
}

function getInstructorId(): string | null {
  if (typeof window === "undefined") return null
  let id = localStorage.getItem("instructorId")
  if (!id) {
    const session = localStorage.getItem("instructorSession")
    if (session) {
      try {
        const data = JSON.parse(session)
        id = data.id || data.databaseId || null
        if (id) localStorage.setItem("instructorId", String(id))
      } catch {
        // ignore
      }
    }
  }
  return id
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (typeof window === "undefined") return headers
  const session = localStorage.getItem("instructorSession")
  const instructorId = localStorage.getItem("instructorId")
  if (session) headers["authorization"] = session
  if (instructorId) headers["x-instructor-id"] = instructorId
  return headers
}

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  switchClass,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  switchClass?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
        {hint ? <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn("shrink-0", switchClass)}
      />
    </div>
  )
}

function parseSection(value: string | null): FacultySettingsSection {
  if (value === "appearance" || value === "preferences" || value === "privacy" || value === "help" || value === "cora-usage") {
    return value
  }
  return "account"
}

export function FacultySettingsHub({ initialSection }: { initialSection?: FacultySettingsSection }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("settings")
  const spinner = facultyModuleSpinnerClass("settings")
  const switchClass = chrome.switchChecked

  const section = initialSection ?? parseSection(searchParams.get("section"))

  const setSection = useCallback(
    (id: FacultySettingsSection) => {
      const base = `${FACULTY_DASHBOARD_BASE}/settings`
      router.replace(id === "account" ? base : `${base}?section=${id}`, { scroll: false })
    },
    [router],
  )

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profile, setProfile] = useState<InstructorProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ name: "", email: "", username: "" })

  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsData | null>(null)

  const loadProfile = useCallback(async () => {
    const instructorId = getInstructorId()
    if (!instructorId) {
      setProfileLoading(false)
      return
    }
    try {
      const res = await instructorApiFetch(`/api/instructor/profile?instructorId=${instructorId}`)
      const data = await res.json()
      if (res.ok && data.instructor) {
        setProfile(data.instructor)
        setProfileForm({
          name: data.instructor.name || "",
          email: data.instructor.email || "",
          username: data.instructor.username || "",
        })
      }
    } catch {
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" })
    } finally {
      setProfileLoading(false)
    }
  }, [toast])

  const loadPreferences = useCallback(async () => {
    const instructorId = getInstructorId()
    if (!instructorId) {
      setPrefsLoading(false)
      return
    }
    try {
      const res = await instructorApiFetch(`/api/instructor/settings?instructorId=${instructorId}`, {
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setSettings({
            preferences: data.settings.preferences,
            security: data.settings.security,
          })
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load preferences", variant: "destructive" })
    } finally {
      setPrefsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadProfile()
    void loadPreferences()
  }, [loadProfile, loadPreferences])

  const saveProfile = async () => {
    const instructorId = getInstructorId()
    if (!instructorId) return
    setProfileSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/profile?instructorId=${instructorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      if (!res.ok) throw new Error("Failed to update")
      await loadProfile()
      toast({ title: "Profile updated", description: "Your changes have been saved.", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" })
    } finally {
      setProfileSaving(false)
    }
  }

  const savePreferences = async () => {
    const instructorId = getInstructorId()
    if (!instructorId || !settings) return
    setPrefsSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ instructorId, settings }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast({ title: "Preferences saved", description: "Your settings have been updated.", variant: "success" })
    } catch {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" })
    } finally {
      setPrefsSaving(false)
    }
  }

  const updateSettings = <K extends keyof SettingsData>(key: K, updates: Partial<SettingsData[K]>) => {
    setSettings((prev) => (prev ? { ...prev, [key]: { ...prev[key], ...updates } } : prev))
  }

  const accountPanel = (
    <InstructorPolicySurfaceCard className="w-full" title="Account" description="Your faculty profile and sign-in details.">
      {profileLoading ? (
        <div className={cn("flex items-center gap-2 py-8", PORTAL_TEXT_MUTED)}>
          <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
          Loading profile…
        </div>
      ) : (
        <>
          <PolicyBlock title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fac-name" className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
                  Full name
                </Label>
                <Input
                  id="fac-name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fac-email" className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
                  Email
                </Label>
                <Input
                  id="fac-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fac-username" className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
                  Username
                </Label>
                <Input
                  id="fac-username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))}
                  className={FIELD}
                />
              </div>
            </div>
          </PolicyBlock>

          <PolicyBlock title="Account details">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3">
                <p className={cn("flex items-center gap-2 text-xs font-medium", PORTAL_TEXT_MUTED)}>
                  <Calendar className="h-3.5 w-3.5" /> Member since
                </p>
                <p className={cn("mt-1 text-sm font-medium", PORTAL_TEXT)}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3">
                <p className={cn("flex items-center gap-2 text-xs font-medium", PORTAL_TEXT_MUTED)}>
                  <UserCircle className="h-3.5 w-3.5" /> Last login
                </p>
                <p className={cn("mt-1 text-sm font-medium", PORTAL_TEXT)}>
                  {profile?.last_login ? new Date(profile.last_login).toLocaleDateString() : "Never"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Account verified
            </div>
          </PolicyBlock>

          <PolicyBlock title="Security">
            <Link href="/instructor/change-password">
              <Button type="button" variant="outline" size="sm" className={cn("h-9 gap-2 rounded-lg", chrome.outline)}>
                <Key className="h-4 w-4" />
                Change password
              </Button>
            </Link>
          </PolicyBlock>

          <div className="flex justify-end border-t border-[var(--border)] pt-4">
            <Button type="button" size="sm" disabled={profileSaving} className={cn("h-9 gap-2 rounded-lg", chrome.cta)} onClick={() => void saveProfile()}>
              {profileSaving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
              Save profile
            </Button>
          </div>
        </>
      )}
    </InstructorPolicySurfaceCard>
  )

  const appearancePanel = (
    <InstructorPolicySurfaceCard
      className="w-full"
      title="Appearance & themes"
      description="Color themes and light / dark mode — synced with the student portal and mobile app."
    >
      <AppearanceSettingsPanel />
    </InstructorPolicySurfaceCard>
  )

  const preferencesPanel = (
    <InstructorPolicySurfaceCard className="w-full" title="Preferences" description="Notifications and session preferences for your faculty account.">
      {prefsLoading ? (
        <div className={cn("flex items-center gap-2 py-8", PORTAL_TEXT_MUTED)}>
          <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
          Loading preferences…
        </div>
      ) : !settings ? (
        <div className="space-y-3">
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Unable to load preferences.</p>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void loadPreferences()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <PolicyBlock title="Notifications">
            <ToggleRow
              label="Push notifications"
              hint="In-app alerts for course activity"
              checked={settings.preferences.notifications}
              onCheckedChange={(v) => updateSettings("preferences", { notifications: v })}
              switchClass={switchClass}
            />
            <ToggleRow
              label="Email notifications"
              hint="Receive updates via email"
              checked={settings.preferences.email_notifications}
              onCheckedChange={(v) => updateSettings("preferences", { email_notifications: v })}
              switchClass={switchClass}
            />
            <ToggleRow
              label="Auto-save"
              hint="Automatically save draft changes"
              checked={settings.preferences.auto_save}
              onCheckedChange={(v) => updateSettings("preferences", { auto_save: v })}
              switchClass={switchClass}
            />
          </PolicyBlock>

          <PolicyBlock title="Security">
            {readFacultySession()?.id != null ? (
              <MfaSecurityStatusCard
                userType="instructor"
                userId={Number(readFacultySession()!.id)}
                accountName={String(readFacultySession()?.email || readFacultySession()?.username || "") || undefined}
                issuer="CourseCollab Faculty"
              />
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3">
              <div>
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Session timeout</p>
                <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Minutes before session expires</p>
              </div>
              <Input
                type="number"
                min={5}
                max={480}
                value={settings.security.session_timeout}
                onChange={(e) =>
                  updateSettings("security", {
                    session_timeout: Math.min(480, Math.max(5, parseInt(e.target.value, 10) || 30)),
                  })
                }
                className={cn(FIELD, "w-20 text-center")}
              />
            </div>
            <ToggleRow
              label="Require password change"
              hint="Force password change on next login"
              checked={settings.security.password_change_required}
              onCheckedChange={(v) => updateSettings("security", { password_change_required: v })}
              switchClass={switchClass}
            />
            <Link href="/instructor/change-password">
              <Button type="button" variant="outline" size="sm" className={cn("h-9 gap-2 rounded-lg", chrome.outline)}>
                <Lock className="h-4 w-4" />
                Change password
              </Button>
            </Link>
          </PolicyBlock>

          <div className="flex justify-end border-t border-[var(--border)] pt-4">
            <Button type="button" size="sm" disabled={prefsSaving} className={cn("h-9 gap-2 rounded-lg", chrome.cta)} onClick={() => void savePreferences()}>
              {prefsSaving ? <RefreshCw className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
              Save preferences
            </Button>
          </div>
        </>
      )}
    </InstructorPolicySurfaceCard>
  )

  const helpPanel = (
    <InstructorPolicySurfaceCard className="w-full" title="Help & support" description="Documentation and support for the faculty dashboard.">
      <PolicyBlock title="Help center">
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          Browse guides, FAQs, and contact options in the learning center help hub.
        </p>
        <Link href={`${FACULTY_DASHBOARD_BASE}/learning-center/help`}>
          <Button type="button" size="sm" className={cn("mt-2 h-9 gap-2 rounded-lg", chrome.cta)}>
            <HelpCircle className="h-4 w-4" />
            Open help center
          </Button>
        </Link>
      </PolicyBlock>
      <PolicyBlock title="Contact">
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          Need assistance with a course or student account? Use office hours or email your program admin.
        </p>
        <Link href={`${FACULTY_DASHBOARD_BASE}/learning-center/office-hours`}>
          <Button type="button" variant="outline" size="sm" className={cn("mt-2 h-9 rounded-lg", chrome.outline)}>
            <Mail className="h-4 w-4 mr-2" />
            Office hours
          </Button>
        </Link>
      </PolicyBlock>
    </InstructorPolicySurfaceCard>
  )

  const privacyPanel = (
    <InstructorPolicySurfaceCard
      className="w-full"
      title="Privacy & legal"
      description="Policy, Cora data practices, and account deletion."
    >
      <PrivacySecurityPanel
        accountKind="instructor"
        authHeaders={buildInstructorApiHeaders()}
        onDeleted={() => logoutFaculty()}
      />
    </InstructorPolicySurfaceCard>
  )

  const coraUsagePanel = (
    <InstructorPolicySurfaceCard
      className="w-full"
      title="Cora usage history"
      description="Search and review detailed Cora activity logs for your account."
    >
      <CoraUsageHistory userId={getInstructorId()} role="instructor" />
    </InstructorPolicySurfaceCard>
  )

  const content =
    section === "appearance"
      ? appearancePanel
      : section === "preferences"
        ? preferencesPanel
        : section === "privacy"
          ? privacyPanel
        : section === "help"
          ? helpPanel
          : section === "cora-usage"
            ? coraUsagePanel
            : accountPanel

  return (
    <FacultyModuleSplitLayout
      menu={
        <FacultyModuleSideMenu
          moduleId="settings"
          title="Settings"
          activeId={section}
          onSelect={(id) => setSection(id as FacultySettingsSection)}
          items={SECTIONS}
        />
      }
    >
      {content}
    </FacultyModuleSplitLayout>
  )
}
