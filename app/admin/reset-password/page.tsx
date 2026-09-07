"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, AlertCircle, CheckCircle2, X, GraduationCap, Lock, Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { AdminProfileDropdown } from "@/components/admin-profile-dropdown"
import { toast } from "@/lib/app-toast"
import { motion } from "framer-motion"

export default function AdminResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    number: false,
    special: false,
  })

  useEffect(() => {
    // Check if admin is logged in
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
    }
  }, [router])

  useEffect(() => {
    // Update password strength indicators
    setPasswordStrength({
      length: newPassword.length >= 8,
      number: /\d/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    })
  }, [newPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }

    // Validate password strength
    if (!passwordStrength.length || !passwordStrength.number || !passwordStrength.special) {
      setError("Password does not meet security requirements")
      return
    }

    setLoading(true)

    try {
      const adminId = sessionStorage.getItem("adminId")

      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId,
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password")
      }

      setSuccess(true)
      toast.success("Password updated successfully!")

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/admin/dashboard")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      toast.error("Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cc-brand-surface cc-brand-auth relative min-h-screen bg-[var(--cc-background)]">
      {/* Ambient aurora wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-12%,color-mix(in_srgb,var(--cc-accent)_8%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_88%_110%,color-mix(in_srgb,var(--cc-brand-gold)_5%,transparent),transparent)]"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--cc-surface)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-[var(--cc-accent)] flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--cc-text)]">CourseCollab</h1>
          </Link>
          <AdminProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/dashboard")}
            className="mb-8 hover:bg-[var(--cc-accent-soft)] rounded-xl group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Button>

          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--cc-surface)] shadow-[0_1px_2px_rgba(15,10,40,0.05),0_8px_24px_-8px_color-mix(in_srgb,var(--cc-accent)_12%,transparent)]">
            <CardHeader className="text-center pb-6">
              <motion.div 
                className="flex justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="h-16 w-16 rounded-2xl bg-[var(--cc-accent)] flex items-center justify-center shadow-lg">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              </motion.div>
              <CardTitle className="text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--cc-text)]">Reset Password</CardTitle>
              <CardDescription className="mt-1.5 text-[14px] text-[var(--cc-text-secondary)]">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-700">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-base text-green-900 dark:text-green-200">
                      Password changed successfully! Redirecting to dashboard...
                    </AlertDescription>
                  </Alert>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="currentPassword" className="text-[13px] font-medium text-[var(--cc-text)] flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Current Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="h-10 rounded-lg pr-12 text-[14px] border border-[var(--border)] focus:border-[var(--cc-accent)] bg-[var(--cc-surface)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] transition-colors"
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="newPassword" className="text-[13px] font-medium text-[var(--cc-text)] flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="h-10 rounded-lg pr-12 text-[14px] border border-[var(--border)] focus:border-[var(--cc-accent)] bg-[var(--cc-surface)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {/* Password strength indicators */}
                    {newPassword && (
                      <div className="space-y-3 mt-4 p-4 bg-[color-mix(in_srgb,var(--cc-accent-soft)_45%,transparent)] rounded-xl">
                        <p className="text-sm font-semibold text-[var(--cc-text)]">Password requirements:</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 text-sm">
                            {passwordStrength.length ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-[var(--cc-text-muted)]" />
                            )}
                            <span className={passwordStrength.length ? "text-green-600 font-medium" : "text-[var(--cc-text-muted)]"}>
                              At least 8 characters
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {passwordStrength.number ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-[var(--cc-text-muted)]" />
                            )}
                            <span className={passwordStrength.number ? "text-green-600 font-medium" : "text-[var(--cc-text-muted)]"}>
                              At least 1 number
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {passwordStrength.special ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-[var(--cc-text-muted)]" />
                            )}
                            <span className={passwordStrength.special ? "text-green-600 font-medium" : "text-[var(--cc-text-muted)]"}>
                              At least 1 special character
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-[var(--cc-text)] flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="h-10 rounded-lg pr-12 text-[14px] border border-[var(--border)] focus:border-[var(--cc-accent)] bg-[var(--cc-surface)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <Alert className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 border-red-200 dark:border-red-700">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-sm text-red-900 dark:text-red-200">{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="h-10 flex-1 rounded-lg bg-[var(--cc-accent)] text-[14px] font-semibold hover:bg-[var(--cc-accent-hover)] text-white"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Changing Password...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Change Password
                        </div>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/dashboard")}
                      disabled={loading}
                      className="h-10 flex-1 rounded-lg border border-[var(--border)] hover:bg-[var(--cc-accent-soft)]"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
