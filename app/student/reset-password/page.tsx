"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  GraduationCap,
  Shield,
  Key,
  Mail,
  User,
  Clock,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

// Zod schema for password validation
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type PasswordFormData = z.infer<typeof passwordSchema>

interface PasswordStrength {
  score: number
  feedback: string[]
  color: string
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordFormData, string>>>({})
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    color: "bg-red-500",
  })
  const [lastPasswordChange, setLastPasswordChange] = useState<string | null>(null)

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchPasswordInfo()
  }, [])

  useEffect(() => {
    calculatePasswordStrength(formData.newPassword)
  }, [formData.newPassword])

  const fetchPasswordInfo = async () => {
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch(`/api/student/password-info?studentId=${studentId}`)
      
      if (response.ok) {
        const data = await response.json()
        setLastPasswordChange(data.lastPasswordChange)
      }
    } catch (error) {
      console.error("Failed to fetch password info:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePasswordStrength = (password: string) => {
    let score = 0
    const feedback: string[] = []

    if (password.length >= 8) {
      score += 1
    } else {
      feedback.push("At least 8 characters")
    }

    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      feedback.push("One uppercase letter")
    }

    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      feedback.push("One lowercase letter")
    }

    if (/[0-9]/.test(password)) {
      score += 1
    } else {
      feedback.push("One number")
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1
    } else {
      feedback.push("One special character")
    }

    let color = "bg-red-500"
    if (score >= 4) color = "bg-green-500"
    else if (score >= 3) color = "bg-yellow-500"
    else if (score >= 2) color = "bg-orange-500"

    setPasswordStrength({ score, feedback, color })
  }

  const validateForm = (data: PasswordFormData): boolean => {
    try {
      passwordSchema.parse(data)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof PasswordFormData, string>> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as keyof PasswordFormData] = err.message
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

    setSubmitting(true)
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch("/api/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId!),
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Password changed successfully!",
        })
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
        fetchPasswordInfo()
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
    } finally {
      setSubmitting(false)
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  if (loading) {
    return (
      <div className="cc-brand-surface cc-brand-auth min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading security settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cc-brand-surface cc-brand-auth min-h-screen">
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

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-pink-600 flex items-center justify-center mx-auto">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800 dark:text-white">
              Reset Password
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Secure your account with a strong password
            </p>
          </motion.div>

          {/* Security Info */}
          {lastPasswordChange && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Password History</CardTitle>
                      <CardDescription>Your account security information</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-slate-500" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Last changed: {new Date(lastPasswordChange).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Math.floor((Date.now() - new Date(lastPasswordChange).getTime()) / (1000 * 60 * 60 * 24))} days ago
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Password Change Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-red-500/10 to-pink-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Change Password</CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-semibold">
                      Current Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPasswords.current ? "text" : "password"}
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className={`rounded-xl pr-10 ${errors.currentPassword ? "border-red-500" : ""}`}
                        placeholder="Enter your current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility("current")}
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.currentPassword && (
                      <p className="text-red-500 text-sm flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.currentPassword}
                      </p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-semibold">
                      New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPasswords.new ? "text" : "password"}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className={`rounded-xl pr-10 ${errors.newPassword ? "border-red-500" : ""}`}
                        placeholder="Enter your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility("new")}
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-red-500 text-sm flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.newPassword}
                      </p>
                    )}
                    
                    {/* Password Strength Indicator */}
                    {formData.newPassword && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Password Strength</span>
                          <span className="text-xs text-slate-500">{passwordStrength.score}/5</span>
                        </div>
                        <Progress value={(passwordStrength.score / 5) * 100} className="h-2">
                          <div className={`h-full ${passwordStrength.color} transition-all duration-300`} />
                        </Progress>
                        {passwordStrength.feedback.length > 0 && (
                          <div className="text-xs text-slate-500">
                            Missing: {passwordStrength.feedback.join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold">
                      Confirm New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords.confirm ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`rounded-xl pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                        placeholder="Confirm your new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility("confirm")}
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-sm flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.confirmPassword}
                      </p>
                    )}
                    {formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                      <p className="text-green-500 text-sm flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  {/* Security Tips */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <h4 className="font-semibold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Tips
                    </h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li>• Use a unique password for this account</li>
                      <li>• Avoid using personal information</li>
                      <li>• Consider using a password manager</li>
                      <li>• Enable two-factor authentication if available</li>
                    </ul>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={submitting || passwordStrength.score < 4}
                      className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl px-8"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Changing Password...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Security Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Additional Security</CardTitle>
                    <CardDescription>Enhance your account security</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-slate-500" />
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-white">Email Verification</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Verify your email address</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Verified
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-slate-500" />
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-white">Two-Factor Authentication</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Add an extra layer of security</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      Enable
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-slate-500" />
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-white">Login Activity</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Review recent login attempts</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  )
}