"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Palette,
  Bell,
  Shield,
  Save,
  RefreshCw,
  User,
  Mail,
  Moon,
  Sun,
  Monitor,
} from "lucide-react"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { MfaSecurityStatusCard } from "@/components/auth/MfaSecurityStatusCard"

interface SettingsData {
  profile: { name: string; email: string; bio: string; avatar: string }
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

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (typeof window === "undefined") return headers
  const session = localStorage.getItem("instructorSession")
  const instructorId = localStorage.getItem("instructorId")
  if (session) headers["authorization"] = session
  if (instructorId) headers["x-instructor-id"] = instructorId
  return headers
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

export default function SettingsSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      const session = localStorage.getItem("instructorSession")
      if (session) {
        try {
          const data = JSON.parse(session)
          if (data.id) {
            fetchSettings()
            return
          }
        } catch {
          // ignore
        }
      }
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [])

  const fetchSettings = async () => {
    const instructorId = getInstructorId()
    if (!instructorId) {
      setLoading(false)
      return
    }
    try {
      const res = await instructorApiFetch(`/api/instructor/settings?instructorId=${instructorId}`, {
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.settings) setSettings(data.settings)
      }
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    const instructorId = getInstructorId()
    if (!instructorId || !settings) return
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ instructorId, settings }),
      })
      if (res.ok) {
        toast({
          title: "Settings saved",
          description: "Your preferences have been updated successfully.",
          variant: "success",
        })
      } else throw new Error("Failed to save")
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const updateSettings = <K extends keyof SettingsData>(
    section: K,
    updates: Partial<SettingsData[K]>
  ) => {
    setSettings((prev) =>
      prev ? { ...prev, [section]: { ...prev[section], ...updates } } : prev
    )
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0">
        <CardWrapper delay={0} hover={false}>
          <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading settings...</p>
          </div>
        </CardWrapper>
      </motion.div>
    )
  }

  if (!settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0">
        <CardWrapper delay={0} hover={false}>
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">Unable to load settings. Please try again.</p>
            <Button variant="outline" onClick={fetchSettings} className="mt-4">
              Retry
            </Button>
          </div>
        </CardWrapper>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 space-y-4 sm:space-y-6"
    >
      {/* Preferences */}
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                <Palette className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Preferences</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Customize your experience</p>
              </div>
            </div>
            <Button
              onClick={saveSettings}
              disabled={saving}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Theme</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose light, dark, or system</p>
              </div>
              <select
                value={settings.preferences.theme}
                onChange={(e) =>
                  updateSettings("preferences", {
                    theme: e.target.value as "light" | "dark" | "system",
                  })
                }
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-medium"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Push Notifications</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Receive in-app notifications</p>
              </div>
              <Switch
                checked={settings.preferences.notifications}
                onCheckedChange={(v) => updateSettings("preferences", { notifications: v })}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Email Notifications</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Receive updates via email</p>
              </div>
              <Switch
                checked={settings.preferences.email_notifications}
                onCheckedChange={(v) => updateSettings("preferences", { email_notifications: v })}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Auto Save</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automatically save changes</p>
              </div>
              <Switch
                checked={settings.preferences.auto_save}
                onCheckedChange={(v) => updateSettings("preferences", { auto_save: v })}
              />
            </div>
          </div>
        </div>
      </CardWrapper>

      {/* Security */}
      <CardWrapper delay={0.05} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
              <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Account security settings</p>
            </div>
          </div>

          <div className="space-y-4">
            {getInstructorId() ? (
              <MfaSecurityStatusCard userType="instructor" userId={getInstructorId()!} />
            ) : null}

            <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Session Timeout</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Minutes before session expires</p>
              </div>
              <Input
                type="number"
                value={settings.security.session_timeout}
                onChange={(e) =>
                  updateSettings("security", {
                    session_timeout: Math.min(480, Math.max(5, parseInt(e.target.value) || 30)),
                  })
                }
                className="w-20 text-center"
                min={5}
                max={480}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <Label className="text-sm font-medium text-slate-900 dark:text-white">Password Change Required</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Force password change on next login</p>
              </div>
              <Switch
                checked={settings.security.password_change_required}
                onCheckedChange={(v) => updateSettings("security", { password_change_required: v })}
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/[0.08]">
            <Link href="/instructor/change-password">
              <Button variant="outline" size="sm" className="border-slate-200 dark:border-white/10">
                Change Password
              </Button>
            </Link>
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
