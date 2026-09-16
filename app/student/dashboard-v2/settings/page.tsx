"use client"

import { useState, useEffect, type ReactNode } from "react"
import {
  Settings,
  User,
  Bell,
  Shield,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Receipt,
  ChevronRight,
  Globe,
  Palette,
  History,
  type LucideIcon,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { useUserTimezoneOptional } from "@/components/providers/user-timezone-provider"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { THEME_DEFINITIONS } from "@/lib/appearance/app-themes"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { MfaSecurityStatusCard } from "@/components/auth/MfaSecurityStatusCard"
import { resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"
import { CalendarFeedSettingsCard } from "@/components/calendar/CalendarFeedSettingsCard"
import { PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"

const settingsTheme = getStudentModuleTheme("settings")

const NOTIFICATION_KEYS = [
  { key: "quiz_reminders", label: "Quiz reminders", desc: "Before quizzes are due" },
  { key: "deadline_alerts", label: "Deadline alerts", desc: "Assignments and exams" },
  { key: "homework_alerts", label: "Homework alerts", desc: "New homework posted" },
  { key: "exam_alerts", label: "Exam alerts", desc: "Mid-terms and finals" },
  { key: "announcements", label: "Announcements", desc: "Course announcements" },
  { key: "forum_replies", label: "Forum replies", desc: "When someone replies" },
] as const

const STORAGE_PREFS_KEY = "cc_notification_prefs"

function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3 sm:space-y-4", className)}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--cc-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function SettingsLinkTile({
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
      <Card
        className={cn(
          "h-full rounded-xl border-0 bg-[var(--muted)]/30 shadow-none transition-colors",
          "hover:bg-[var(--muted)]/45",
        )}
      >
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl",
              settingsTheme.page.iconBg,
              settingsTheme.page.iconText,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--cc-text)]">{title}</p>
            <p className="mt-0.5 text-sm text-[var(--cc-text-muted)] line-clamp-2">{description}</p>
            {meta ? (
              <p className="mt-1.5 text-xs font-medium text-[var(--cc-accent-dark)]">{meta}</p>
            ) : null}
          </div>
          <ChevronRight className="size-5 shrink-0 text-[var(--cc-text-muted)] transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  )
}

function SettingsPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className={cn("h-full rounded-xl border-0 bg-[var(--muted)]/30 shadow-none")}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              settingsTheme.page.iconBg,
              settingsTheme.page.iconText,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-[var(--cc-text)]">{title}</CardTitle>
            <CardDescription className="text-[var(--cc-text-muted)]">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  )
}

export default function DashboardV2SettingsPage() {
  const { toast } = useToast()
  const deviceTz = useUserTimezoneOptional()?.timezone
  const { themeId, appearanceMode, isDark } = useAppearance()
  const themeName = THEME_DEFINITIONS.find((t) => t.id === themeId)?.name ?? "Default"
  const appearanceLabel =
    appearanceMode === "system" ? "System" : isDark ? "Dark" : "Light"

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [studentIdCode, setStudentIdCode] = useState("")
  const [profileError, setProfileError] = useState<string | null>(null)

  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState({ current: "", new: "", confirm: "" })
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({})
  const [notifSaving, setNotifSaving] = useState(false)

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    studentApiFetch(`/api/student/profile?studentId=${dbId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const s = data.student || data.profile
        if (s) {
          setFullName(s.full_name || "")
          setEmail(s.email || "")
          setStudentIdCode(s.student_id || "")
        }
      })
      .catch(() => setProfileError("Could not load profile"))
      .finally(() => setProfileLoading(false))
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFS_KEY)
      const parsed = stored ? JSON.parse(stored) : {}
      const defaults: Record<string, boolean> = {}
      NOTIFICATION_KEYS.forEach(({ key }) => {
        defaults[key] = parsed[key] ?? true
      })
      setNotifPrefs(defaults)
    } catch {
      setNotifPrefs(Object.fromEntries(NOTIFICATION_KEYS.map(({ key }) => [key, true])))
    }
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    setProfileError(null)
    setProfileSaving(true)
    try {
      const res = await studentApiFetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(dbId),
          fullName: fullName.trim(),
          email: email.trim() || null,
          studentIdCode: studentIdCode.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      sessionStorage.setItem("studentName", fullName.trim())
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
        variant: "success",
      })
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save")
      toast({ title: "Error", description: "Could not update profile", variant: "destructive" })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (password.new.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (password.new !== password.confirm) {
      setPasswordError("Passwords do not match")
      return
    }
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    setPasswordSaving(true)
    try {
      const res = await studentApiFetch("/api/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(dbId),
          currentPassword: password.current,
          newPassword: password.new,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to change password")
      setPassword({ current: "", new: "", confirm: "" })
      toast({ title: "Success", description: "Password changed successfully" })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password")
      toast({ title: "Error", description: "Could not change password", variant: "destructive" })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSaveNotifs = () => {
    setNotifSaving(true)
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(notifPrefs))
      toast({
        title: "Preferences saved",
        description: "Your notification settings have been updated.",
        variant: "success",
      })
    } finally {
      setNotifSaving(false)
    }
  }

  const setNotif = (key: string, value: boolean) => {
    setNotifPrefs((p) => ({ ...p, [key]: value }))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full min-w-0 pb-8"
    >
      <EmbedModuleCard>
        <div className="space-y-8 p-4 sm:p-5">
      <SettingsSection title="Quick access" description="Jump to dedicated settings pages.">
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsLinkTile
            href="/student/dashboard-v2/settings/appearance"
            icon={Palette}
            title="Appearance & themes"
            description="Color themes and light / dark mode"
            meta={`${themeName} · ${appearanceLabel}`}
          />
          <SettingsLinkTile
            href="/student/dashboard-v2/settings/purchases"
            icon={Receipt}
            title="Purchase history"
            description="Invoices, receipts, and refund requests"
          />
          <SettingsLinkTile
            href="/student/dashboard-v2/cora-credits"
            icon={History}
            title="Cora Credits"
            description="Balance, monthly allowance, packs, and usage history"
          />
          <SettingsLinkTile
            href="/student/dashboard-v2/settings/privacy"
            icon={Shield}
            title="Privacy & legal"
            description="Privacy policy, AI & data, and account deletion"
          />
        </div>
      </SettingsSection>

      {/* Account & security */}
      <SettingsSection
        title="Account & security"
        description="Update your personal details and sign-in password."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsPanel icon={User} title="Profile" description="Name, email, and student ID">
            {profileLoading ? (
              <div className="flex items-center gap-2 py-8 text-[var(--cc-text-muted)]">
                <Loader2 className="size-4 animate-spin" />
                Loading profile…
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentIdCode">Student ID</Label>
                  <Input
                    id="studentIdCode"
                    value={studentIdCode}
                    onChange={(e) => setStudentIdCode(e.target.value)}
                    placeholder="Your student ID"
                    className="rounded-lg"
                  />
                </div>
                {profileError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>
                ) : null}
                <Button type="submit" disabled={profileSaving} className={cn("text-white", settingsTheme.page.cta)}>
                  {profileSaving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Save profile
                </Button>
              </form>
            )}
          </SettingsPanel>

          <SettingsPanel icon={Lock} title="Password" description="Change your sign-in password">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <div className="relative">
                  <Input
                    id="current"
                    type={showPassword ? "text" : "password"}
                    value={password.current}
                    onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                    placeholder="••••••••"
                    className="rounded-lg pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)]"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New password</Label>
                <Input
                  id="new"
                  type={showPassword ? "text" : "password"}
                  value={password.new}
                  onChange={(e) => setPassword((p) => ({ ...p, new: e.target.value }))}
                  placeholder="••••••••"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={password.confirm}
                  onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••"
                  className="rounded-lg"
                />
              </div>
              {passwordError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              ) : null}
              <Button
                type="submit"
                disabled={passwordSaving || !password.current || !password.new || !password.confirm}
                className={cn("text-white", settingsTheme.page.cta)}
              >
                {passwordSaving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 size-4" />
                )}
                Change password
              </Button>
            </form>
          </SettingsPanel>
        </div>
        {resolveStudentDatabaseId() ? (
          <MfaSecurityStatusCard
            userType="student"
            userId={resolveStudentDatabaseId()!}
            issuer="CourseCollab"
          />
        ) : null}
      </SettingsSection>
      <SettingsSection title="Preferences" description="Notifications and regional settings.">
        <Card className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  settingsTheme.page.iconBg,
                  settingsTheme.page.iconText,
                )}
              >
                <Globe className="size-5" />
              </span>
              <div>
                <p className="font-medium text-[var(--cc-text)]">Time zone</p>
                <p className="text-sm text-[var(--cc-text-muted)]">
                  Dates and times follow your device automatically
                </p>
              </div>
            </div>
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm font-medium text-[var(--cc-text)] sm:text-right">
              {deviceTz ?? "Detecting…"}
            </p>
          </div>

          <CardHeader className="border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  settingsTheme.page.iconBg,
                  settingsTheme.page.iconText,
                )}
              >
                <Bell className="size-5" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold text-[var(--cc-text)]">Notifications</CardTitle>
                <CardDescription className="text-[var(--cc-text-muted)]">
                  Choose which alerts you want to receive
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
              {NOTIFICATION_KEYS.map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-lg px-1 py-3 sm:py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--cc-text)]">{label}</p>
                    <p className="text-xs text-[var(--cc-text-muted)]">{desc}</p>
                  </div>
                  <Switch
                    checked={notifPrefs[key] ?? true}
                    onCheckedChange={(v) => setNotif(key, v)}
                    className="shrink-0 data-[state=checked]:bg-[var(--cc-accent)]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4">
              <Button
                onClick={handleSaveNotifs}
                disabled={notifSaving}
                variant="outline"
                className={cn("w-full sm:w-auto", portalOutlineButtonClass(settingsTheme))}
              >
                {notifSaving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Save notification preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        <CalendarFeedSettingsCard
          portal="student"
          description="Subscribe so Google, Outlook, or Apple Calendar stay updated when class times change. Separate from the in-app alerts above."
          switchClass="data-[state=checked]:bg-[var(--cc-accent)]"
          ctaClass={PORTAL_CTA}
          quietClass={portalOutlineButtonClass(settingsTheme)}
        />
      </SettingsSection>
        </div>
      </EmbedModuleCard>
    </motion.div>
  )
}
