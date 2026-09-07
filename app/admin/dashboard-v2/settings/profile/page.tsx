"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  User,
  Mail,
  UserCircle,
  Calendar,
  Shield,
  Key,
  Lock,
  CheckCircle2,
  Edit2,
  Save,
  X,
  BarChart3,
} from "lucide-react"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface InstructorProfile {
  id: number
  username: string
  email: string
  name: string
  created_at: string
  last_login: string | null
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

export default function SettingsProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<InstructorProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", username: "" })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const instructorId = getInstructorId()
    if (!instructorId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/admin/dashboard-v2/settings/profile?instructorId=${instructorId}`)
      const data = await res.json()
      if (res.ok && data.instructor) {
        setProfile(data.instructor)
        setFormData({
          name: data.instructor.name || "",
          email: data.instructor.email || "",
          username: data.instructor.username || "",
        })
      }
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const instructorId = getInstructorId()
    if (!instructorId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/dashboard-v2/settings/profile?instructorId=${instructorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsEditing(false)
        fetchProfile()
        toast({
          title: "Profile updated",
          description: "Your changes have been saved successfully.",
          variant: "success",
        })
      } else throw new Error("Failed to update")
    } catch {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) setFormData({ name: profile.name || "", email: profile.email || "", username: profile.username || "" })
    setIsEditing(false)
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0">
        <CardWrapper delay={0} hover={false}>
          <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading profile...</p>
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
      className="w-full min-w-0"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2">
          <CardWrapper delay={0} hover={false}>
            <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                    <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile Information</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Update your personal details</p>
                  </div>
                </div>
                {!isEditing && (
                  <Button onClick={() => setIsEditing(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      className="border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      className="border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                      className="border-slate-200 dark:border-white/10"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <UserCircle className="h-3.5 w-3.5" /> Full Name
                    </Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.email || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <User className="h-3.5 w-3.5" /> Username
                    </Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{profile?.username || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" /> Member Since
                    </Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardWrapper>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <CardWrapper delay={0.05} hover={false}>
            <div className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Account
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Last Login</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {profile?.last_login ? new Date(profile.last_login).toLocaleDateString() : "Never"}
                  </span>
                </div>
              </div>
            </div>
          </CardWrapper>

          <CardWrapper delay={0.1} hover={false}>
            <div className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Security
              </h3>
              <div className="space-y-3">
                <Link href="/instructor/change-password">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-slate-200 dark:border-white/10">
                    <Key className="h-4 w-4" />
                    Change Password
                  </Button>
                </Link>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Two-Factor Auth
                  </span>
                  <Switch disabled />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Account verified
                </div>
              </div>
            </div>
          </CardWrapper>
        </div>
      </div>
    </motion.div>
  )
}
