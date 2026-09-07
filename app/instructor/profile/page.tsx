"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft,
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
  Users,
  FileText,
  Clock,
  Sparkles
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

interface InstructorProfile {
  id: number
  username: string
  email: string
  name: string
  created_at: string
  last_login: string | null
}

export default function InstructorProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<InstructorProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: ""
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const instructorId = sessionStorage.getItem("instructorId") || "1"
      const response = await instructorApiFetch(`/api/instructor/profile?instructorId=${instructorId}`)
      const data = await response.json()
      
      if (response.ok) {
        setProfile(data.instructor)
        setFormData({
          name: data.instructor.name || "",
          email: data.instructor.email || "",
          username: data.instructor.username || ""
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast({
        title: "Error",
        description: "Failed to load profile information",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const instructorId = sessionStorage.getItem("instructorId") || "1"
      const response = await instructorApiFetch(`/api/instructor/profile?instructorId=${instructorId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setIsEditing(false)
        fetchProfile()
        toast({
          title: "Success",
          description: "Profile updated successfully",
        })
      } else {
        throw new Error("Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        username: profile.username || ""
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 dark:text-slate-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Profile Settings
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage your instructor account information and preferences
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
          <Button
            onClick={() => router.push("/instructor/dashboard")}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information - Main Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Profile Information</CardTitle>
                      <CardDescription className="mt-1">
                        Update your personal information and contact details
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-indigo-600" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter your full name"
                        className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4 text-indigo-600" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter your email"
                        className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-600" />
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Enter your username"
                        className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500"
                      />
                    </div>
                    <Separator />
                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <UserCircle className="h-4 w-4" />
                          Full Name
                        </Label>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {profile?.name || "Not set"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Address
                        </Label>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {profile?.email || "Not set"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Username
                        </Label>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {profile?.username || "Not set"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Member Since
                        </Label>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {profile?.created_at 
                            ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Stats and Security */}
          <div className="space-y-6">
            {/* Account Statistics */}
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Account Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Courses</span>
                  </div>
                  <Badge variant="outline" className="text-blue-600 border-blue-600 font-semibold">5</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Students</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600 font-semibold">127</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Assessments</span>
                  </div>
                  <Badge variant="outline" className="text-purple-600 border-purple-600 font-semibold">23</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Last Login</span>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-600 font-semibold">
                    {profile?.last_login 
                      ? new Date(profile.last_login).toLocaleDateString()
                      : "Never"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-red-500" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/instructor/change-password" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2 h-11 hover:bg-slate-50 dark:hover:bg-slate-900">
                    <Key className="h-4 w-4 text-indigo-600" />
                    Change Password
                  </Button>
                </Link>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Two-Factor Auth</span>
                  </div>
                  <Switch />
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Account verified</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  )
}
