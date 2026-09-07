"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, AlertCircle, CheckCircle2, X, Sparkles, Zap, Rocket, Gift, CheckCircle, ClipboardList, Lightbulb, Bot, Code2, UsersRound, Trophy, Calendar } from "lucide-react"
import { getStudentData, patchStudentSessionPasswordChanged, studentApiFetch } from "@/lib/auth"
import { resolveStudentPostLoginPath, syncAppearanceSetupFromServer } from "@/lib/appearance/appearance-setup"
import { AuthGlassCard, AuthShell } from "@/components/auth/AuthShell"
import { cn } from "@/lib/utils"

const inputClass =
  "h-12 rounded-xl border-[var(--border)] bg-[var(--cc-surface)] text-[var(--cc-text)] placeholder:text-[var(--cc-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/35"

const toggleClass =
  "absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)] transition-colors"

const platformPerks = [
  {
    icon: ClipboardList,
    title: "Interactive Quizzes",
    description: "Take quizzes and track your progress",
    iconClass: "text-pink-600 dark:text-pink-300",
    iconBg: "bg-pink-500/15 dark:bg-pink-400/20",
  },
  {
    icon: Lightbulb,
    title: "Practice Hub",
    description: "Generate practice quizzes from question bank",
    iconClass: "text-purple-600 dark:text-purple-300",
    iconBg: "bg-purple-500/15 dark:bg-purple-400/20",
  },
  {
    icon: Bot,
    title: "AI Tutor",
    description: "Get help from your personal AI teaching assistant",
    iconClass: "text-blue-600 dark:text-blue-300",
    iconBg: "bg-blue-500/15 dark:bg-blue-400/20",
  },
  {
    icon: Zap,
    title: "Playground",
    description: "Join Kahoot-style game sessions",
    iconClass: "text-amber-600 dark:text-amber-300",
    iconBg: "bg-amber-500/15 dark:bg-amber-400/20",
  },
  {
    icon: Code2,
    title: "CodeBench",
    description: "Write, run, and debug C++ code",
    iconClass: "text-emerald-600 dark:text-emerald-300",
    iconBg: "bg-emerald-500/15 dark:bg-emerald-400/20",
  },
  {
    icon: UsersRound,
    title: "Groups & Projects",
    description: "Collaborate with classmates",
    iconClass: "text-indigo-600 dark:text-indigo-300",
    iconBg: "bg-indigo-500/15 dark:bg-indigo-400/20",
  },
  {
    icon: Trophy,
    title: "Classroom Points",
    description: "Earn points and compete on leaderboards",
    iconClass: "text-orange-600 dark:text-orange-300",
    iconBg: "bg-orange-500/15 dark:bg-orange-400/20",
  },
  {
    icon: Calendar,
    title: "Attendance Tracking",
    description: "Mark attendance and track your streak",
    iconClass: "text-teal-600 dark:text-teal-300",
    iconBg: "bg-teal-500/15 dark:bg-teal-400/20",
  },
] as const

const perkCardClass =
  "group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_92%,var(--cc-accent)_8%)] transition-all duration-300 hover:border-[var(--cc-accent)]/45 hover:shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center space-y-3 sm:space-y-5 px-2"
      >
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
          className="inline-flex items-center justify-center relative"
        >
          <div className="absolute inset-0 rounded-full bg-[var(--cc-accent)]/15 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--cc-accent)] shadow-lg shadow-[var(--cc-accent)]/25 sm:h-20 sm:w-20 sm:rounded-2xl md:h-24 md:w-24">
            <Gift className="h-8 w-8 text-white sm:h-10 sm:w-10 md:h-12 md:w-12" />
          </div>
          {/* Subtle sparkles */}
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2"
          >
            <Sparkles className="h-4 w-4 fill-amber-300 text-amber-300 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="space-y-2 sm:space-y-3"
        >
          <h2 className="px-2 text-2xl font-extrabold tracking-tight text-[var(--cc-text)] sm:text-3xl md:text-4xl lg:text-5xl">
            Welcome to CourseCollab!
          </h2>
          <p className="mx-auto max-w-2xl px-4 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base md:text-lg lg:text-xl">
            Your account is ready! Discover powerful tools designed to enhance your learning journey.
          </p>
        </motion.div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"
      >
        <AnimatePresence>
          {platformPerks.map((perk, index) => {
            const Icon = perk.icon
            return (
              <motion.div
                key={perk.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: 0.7 + index * 0.05,
                  duration: 0.4,
                  ease: "easeOut"
                }}
              >
                <div className={perkCardClass}>
                  <div className="p-3 sm:p-4 md:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <motion.div
                        whileHover={{ scale: 1.08, rotate: 4 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className={cn(
                          perk.iconBg,
                          "flex-shrink-0 rounded-lg p-2.5 sm:rounded-xl sm:p-3 md:p-3.5",
                        )}
                      >
                        <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", perk.iconClass)} />
                      </motion.div>

                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                        <h3 className="text-sm font-semibold text-[var(--cc-text)] transition-colors group-hover:text-[var(--cc-accent)] sm:text-base md:text-lg">
                          {perk.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-[var(--cc-text-secondary)] sm:text-sm">
                          {perk.description}
                        </p>
                      </div>

                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: 0.8 + index * 0.05,
                          type: "spring",
                          stiffness: 200,
                        }}
                        className="mt-0.5 flex-shrink-0 sm:mt-1"
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 sm:h-5 sm:w-5" />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="pt-2 px-2"
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={onGetStarted}
            className="relative h-14 w-full overflow-hidden rounded-2xl bg-[var(--cc-accent)] text-base font-semibold text-white hover:bg-[color-mix(in_srgb,var(--cc-accent)_88%,black_12%)] sm:h-16 sm:text-lg"
            size="lg"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Get Started</span>
            </span>
          </Button>
        </motion.div>
        
        {/* Subtle helper text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mt-2 px-2 text-center text-xs text-[var(--cc-text-secondary)] sm:mt-3 sm:text-sm"
        >
          Start exploring your personalized learning platform
        </motion.p>
      </motion.div>
    </div>
  )
}

function ChangePasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirstLogin = searchParams.get("firstLogin") === "true"

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isFirstPasswordChange, setIsFirstPasswordChange] = useState(false)

  const postPasswordChangePath = async () => {
    const dbId = getStudentData()?.databaseId ?? sessionStorage.getItem("studentDatabaseId")
    if (dbId) {
      const appearanceSetupCompleted = await syncAppearanceSetupFromServer(dbId)
      return resolveStudentPostLoginPath({
        studentDbId: dbId,
        hasChangedPassword: true,
        appearanceSetupCompleted,
      })
    }
    return "/student/dashboard-v2"
  }

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    number: false,
    special: false,
  })

  useEffect(() => {
    // Check if student is logged in
    const studentId = sessionStorage.getItem("studentDatabaseId")
    if (!studentId) {
      router.push("/student/login")
      return
    }

    // DEMO STUDENT: Skip trial modal - demo student has unlimited Trailblazer access, not trial
    const studentData = sessionStorage.getItem("studentSession")
    if (studentData) {
      try {
        const parsed = JSON.parse(studentData)
        const isDemoStudent = parsed.id === "DEMO001" || parsed.section === "BETA"
        if (isDemoStudent) {
          sessionStorage.removeItem("showTrialModal")
          sessionStorage.removeItem("trialActivated")
        }
      } catch (e) {
        // Ignore parse errors
      }
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
      const studentId = sessionStorage.getItem("studentDatabaseId")

      const response = await studentApiFetch("/api/student/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password")
      }

      setSuccess(true)
      patchStudentSessionPasswordChanged()
      
      // Check if this is the first password change
      const firstChange = data.trialActivated || isFirstLogin
      setIsFirstPasswordChange(firstChange)
      
      // Clear any trial modal flags (no longer using modal)
      sessionStorage.removeItem("showTrialModal")
      sessionStorage.removeItem("trialActivated")
      
      // Show welcome page for first password change
      if (firstChange) {
        setShowWelcome(true)
      } else {
        // Redirect to dashboard after 2 seconds for subsequent password changes
        setTimeout(() => {
          void postPasswordChangePath().then((path) => router.push(path))
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      showBack={!isFirstLogin}
      backHref="/student/dashboard-v2"
      contentMaxWidth={showWelcome ? "max-w-4xl" : "max-w-md"}
    >
      <AuthGlassCard className={showWelcome ? "p-6 sm:p-8" : undefined}>
        {!showWelcome && (
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--cc-text)]">Change Password</h1>
            <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">
              {isFirstLogin
                ? "For security, you must change your password before accessing quizzes."
                : "Update your password to keep your account secure."}
            </p>
          </div>
        )}
        <div>
            {isFirstLogin && !showWelcome && (
              <Alert className="mb-6 border-amber-500/30 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-sm text-amber-950 dark:text-amber-100">
                  This is your first time logging in. You cannot access quizzes until you change your password.
                </AlertDescription>
              </Alert>
            )}

            {showWelcome ? (
              <WelcomeScreen onGetStarted={() => { void postPasswordChangePath().then((path) => router.push(path)) }} />
            ) : success ? (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="text-sm text-emerald-950 dark:text-emerald-100">
                  Password changed successfully! Redirecting to dashboard...
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-[var(--cc-text)]">
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
                      className={cn(inputClass, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className={toggleClass}
                      tabIndex={-1}
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-[var(--cc-text)]">
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
                      className={cn(inputClass, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className={toggleClass}
                      tabIndex={-1}
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength indicators */}
                  {newPassword && (
                    <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-surface)_92%,var(--cc-accent)_8%)] p-3">
                      <p className="text-xs font-medium text-[var(--cc-text-secondary)]">Password requirements:</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          {passwordStrength.length ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <X className="h-3 w-3 text-[var(--cc-text-muted)]" />
                          )}
                          <span
                            className={
                              passwordStrength.length
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-[var(--cc-text-secondary)]"
                            }
                          >
                            At least 8 characters
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {passwordStrength.number ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <X className="h-3 w-3 text-[var(--cc-text-muted)]" />
                          )}
                          <span
                            className={
                              passwordStrength.number
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-[var(--cc-text-secondary)]"
                            }
                          >
                            At least 1 number
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {passwordStrength.special ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <X className="h-3 w-3 text-[var(--cc-text-muted)]" />
                          )}
                          <span
                            className={
                              passwordStrength.special
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-[var(--cc-text-secondary)]"
                            }
                          >
                            At least 1 special character
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[var(--cc-text)]">
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
                      className={cn(inputClass, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={toggleClass}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <Alert className="border-destructive/30 bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm text-destructive">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-[var(--cc-accent)] font-semibold text-white hover:bg-[color-mix(in_srgb,var(--cc-accent)_88%,black_12%)]"
                  disabled={loading}
                >
                  {loading ? "Changing Password..." : "Change Password"}
                </Button>

                {!isFirstLogin && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-[var(--border)] bg-transparent text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]"
                    onClick={() => router.push("/student/dashboard-v2")}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                )}
              </form>
            )}
        </div>
      </AuthGlassCard>
    </AuthShell>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChangePasswordContent />
    </Suspense>
  )
}
