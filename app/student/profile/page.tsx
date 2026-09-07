"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Camera,
  Shield,
  Star,
  Award,
  Target,
  Zap,
  Crown,
  Sparkles,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { initialsFromName } from "@/lib/initials-from-name"
// Zod schema for form validation
const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  email: z.union([z.string().email("Please enter a valid email address"), z.literal("")]),
  studentIdCode: z.string().max(50).optional(),
  phone: z.string().optional().refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), "Please enter a valid phone number"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  location: z.string().max(100, "Location must be less than 100 characters").optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  linkedin: z.string().url("Please enter a valid LinkedIn URL").optional().or(z.literal("")),
  github: z.string().url("Please enter a valid GitHub URL").optional().or(z.literal("")),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface StudentProfile {
  id: number
  full_name: string
  email: string
  phone?: string
  bio?: string
  location?: string
  website?: string
  linkedin?: string
  github?: string
  avatar_url?: string
  created_at: string
  last_login: string
  section: string
  membership_tier: string
  reputation_points: number
  badges: string[]
  achievements: {
    quizzes_completed: number
    lectures_attended: number
    forum_posts: number
    streak_days: number
  }
}

export default function StudentProfilePage() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [formData, setFormData] = useState<ProfileFormData>({
    fullName: "",
    email: "",
    studentIdCode: "",
    phone: "",
    bio: "",
    location: "",
    website: "",
    linkedin: "",
    github: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({})
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch(`/api/student/profile?studentId=${studentId}`)
      
      if (response.ok) {
        const data = await response.json()
        const s = data.student || data.profile
        if (!s) throw new Error("Invalid profile response")
        setProfile(s)
        setFormData({
          fullName: s.full_name || "",
          email: s.email || "",
          studentIdCode: s.student_id || "",
          phone: s.phone || "",
          bio: s.bio || "",
          location: s.location || "",
          website: s.website || "",
          linkedin: s.linkedin || "",
          github: s.github || "",
        })
      } else {
        throw new Error("Failed to fetch profile")
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error)
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (data: ProfileFormData): boolean => {
    try {
      profileSchema.parse(data)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProfileFormData, string>> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof ProfileFormData] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm(formData)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch("/api/student/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId!),
          fullName: formData.fullName,
          email: formData.email?.trim() || null,
          studentIdCode: formData.studentIdCode?.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Profile updated",
          description: "Your changes have been saved successfully.",
          variant: "success",
        })
        sessionStorage.setItem("studentName", formData.fullName)
        fetchProfile()
      } else {
        throw new Error(data.error || "Failed to update profile")
      }
    } catch (error) {
      console.error("Failed to update profile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate password form
    const newPasswordErrors: Record<string, string> = {}
    
    if (!passwordData.currentPassword) {
      newPasswordErrors.currentPassword = "Current password is required"
    }
    
    if (!passwordData.newPassword) {
      newPasswordErrors.newPassword = "New password is required"
    } else if (passwordData.newPassword.length < 8) {
      newPasswordErrors.newPassword = "Password must be at least 8 characters"
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newPasswordErrors.confirmPassword = "Passwords do not match"
    }
    
    if (Object.keys(newPasswordErrors).length > 0) {
      setPasswordErrors(newPasswordErrors)
      return
    }
    
    setPasswordErrors({})
    
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch("/api/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId!),
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Password changed successfully!",
        })
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        const data = await response.json()
        throw new Error(data.error || "Failed to change password")
      }
    } catch (error) {
      console.error("Failed to change password:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      })
    }
  }

  const getMembershipColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "premium":
        return "from-yellow-400 to-orange-500"
      case "pro":
        return "from-purple-500 to-indigo-600"
      case "basic":
        return "from-blue-500 to-cyan-600"
      default:
        return "from-slate-400 to-slate-600"
    }
  }

  const getMembershipIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "premium":
        return <Crown className="h-5 w-5" />
      case "pro":
        return <Star className="h-5 w-5" />
      case "basic":
        return <Award className="h-5 w-5" />
      default:
        return <User className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <User className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
          </Link>
          <StudentProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push(homeLink)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-8">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                      <AvatarImage src={profile?.avatar_url} mediaSize="small" />
                      <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                        {initialsFromName(profile?.full_name ?? "", "ST")}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      size="sm"
                      className="absolute -bottom-2 -right-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
                        {profile?.full_name || "Student"}
                      </h1>
                      <Badge className={`bg-gradient-to-r ${getMembershipColor(profile?.membership_tier || "basic")} text-white`}>
                        {getMembershipIcon(profile?.membership_tier || "basic")}
                        <span className="ml-1">{profile?.membership_tier || "Basic"}</span>
                      </Badge>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg mb-3">
                      {profile?.bio || "No bio available"}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Joined {new Date(profile?.created_at || "").toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span>Section {profile?.section}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-4 w-4" />
                        <span>{profile?.reputation_points || 0} reputation</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Profile Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Basic Information */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Basic Information</CardTitle>
                      <CardDescription>Update your personal details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm font-semibold">
                          Full Name *
                        </Label>
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className={`rounded-xl ${errors.fullName ? "border-red-500" : ""}`}
                          placeholder="Enter your full name"
                        />
                        {errors.fullName && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.fullName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`rounded-xl ${errors.email ? "border-red-500" : ""}`}
                          placeholder="your.email@example.com"
                        />
                        {errors.email && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="studentIdCode" className="text-sm font-semibold">
                          Student ID
                        </Label>
                        <Input
                          id="studentIdCode"
                          value={formData.studentIdCode ?? ""}
                          onChange={(e) => setFormData({ ...formData, studentIdCode: e.target.value })}
                          className={`rounded-xl ${errors.studentIdCode ? "border-red-500" : ""}`}
                          placeholder="Your student ID (e.g. 12345)"
                        />
                        {errors.studentIdCode && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.studentIdCode}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold">
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className={`rounded-xl ${errors.phone ? "border-red-500" : ""}`}
                          placeholder="Enter your phone number"
                        />
                        {errors.phone && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.phone}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location" className="text-sm font-semibold">
                          Location
                        </Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className={`rounded-xl ${errors.location ? "border-red-500" : ""}`}
                          placeholder="Enter your location"
                        />
                        {errors.location && (
                          <p className="text-red-500 text-sm flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.location}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-sm font-semibold">
                        Bio
                      </Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        className={`rounded-xl min-h-[100px] ${errors.bio ? "border-red-500" : ""}`}
                        placeholder="Tell us about yourself..."
                      />
                      {errors.bio && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.bio}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={saving}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl px-8"
                      >
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Social Links */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Social Links</CardTitle>
                      <CardDescription>Connect your social profiles</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="website" className="text-sm font-semibold">
                        Website
                      </Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className={`rounded-xl ${errors.website ? "border-red-500" : ""}`}
                        placeholder="https://yourwebsite.com"
                      />
                      {errors.website && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.website}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="linkedin" className="text-sm font-semibold">
                        LinkedIn
                      </Label>
                      <Input
                        id="linkedin"
                        value={formData.linkedin}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                        className={`rounded-xl ${errors.linkedin ? "border-red-500" : ""}`}
                        placeholder="https://linkedin.com/in/yourprofile"
                      />
                      {errors.linkedin && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.linkedin}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github" className="text-sm font-semibold">
                        GitHub
                      </Label>
                      <Input
                        id="github"
                        value={formData.github}
                        onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                        className={`rounded-xl ${errors.github ? "border-red-500" : ""}`}
                        placeholder="https://github.com/yourusername"
                      />
                      {errors.github && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.github}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Password Change */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-red-500/10 to-pink-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Security</CardTitle>
                      <CardDescription>Change your password</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword" className="text-sm font-semibold">
                        Current Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPassword ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className={`rounded-xl pr-10 ${passwordErrors.currentPassword ? "border-red-500" : ""}`}
                          placeholder="Enter current password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {passwordErrors.currentPassword}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-sm font-semibold">
                        New Password
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className={`rounded-xl ${passwordErrors.newPassword ? "border-red-500" : ""}`}
                        placeholder="Enter new password"
                      />
                      {passwordErrors.newPassword && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {passwordErrors.newPassword}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className={`rounded-xl ${passwordErrors.confirmPassword ? "border-red-500" : ""}`}
                        placeholder="Confirm new password"
                      />
                      {passwordErrors.confirmPassword && (
                        <p className="text-red-500 text-sm flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {passwordErrors.confirmPassword}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl px-6"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Change Password
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-6"
            >
              {/* Profile Completion */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Profile Completion</CardTitle>
                      <p className="text-indigo-100 text-sm">Complete your profile</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-indigo-100">Progress</span>
                      <span className="text-sm font-semibold">75%</span>
                    </div>
                    <Progress value={75} className="h-2 bg-white/20" />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-300" />
                      <span className="text-indigo-100">Basic Information</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-300" />
                      <span className="text-indigo-100">Email Verified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-300" />
                      <span className="text-indigo-100">Add Bio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-300" />
                      <span className="text-indigo-100">Social Links</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Achievements</CardTitle>
                      <p className="text-slate-500 text-sm">Your learning progress</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {profile?.achievements.quizzes_completed || 0}
                      </div>
                      <div className="text-xs text-slate-500">Quizzes</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {profile?.achievements.lectures_attended || 0}
                      </div>
                      <div className="text-xs text-slate-500">Lectures</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {profile?.achievements.forum_posts || 0}
                      </div>
                      <div className="text-xs text-slate-500">Posts</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {profile?.achievements.streak_days || 0}
                      </div>
                      <div className="text-xs text-slate-500">Streak</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Badges */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Badges</CardTitle>
                      <p className="text-slate-500 text-sm">Earned achievements</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {profile?.badges?.length ? (
                      profile.badges.map((badge, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                            <Award className="h-4 w-4 text-white" />
                          </div>
                          <span className="font-semibold text-sm">{badge}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm text-center py-4">
                        No badges earned yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  )
}