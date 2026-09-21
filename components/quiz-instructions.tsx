"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, AlertTriangle, Lightbulb, Calculator, Monitor, Navigation, Shield, Eye, EyeOff, Copy, X, Maximize2, MapPin } from "lucide-react"
import { motion } from "framer-motion"
import { StudentHeader } from "@/components/student-header"
import { useGeminiDetector } from "@/hooks/use-gemini-detector"
import { isPhoneOrTabletDevice, isBrowserAiEnforcementPlatform } from "@/lib/device-utils"
import { isDocumentFullscreen, requestDocumentFullscreen, subscribeDocumentFullscreen } from "@/lib/document-fullscreen"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"
import { SuperpowersSelector } from "@/components/superpowers-selector"
import type { SuperpowerId } from "@/lib/superpowers-constants"
import type { MembershipTier } from "@/lib/membership-constants"
import type { StudentPickSectionSummary } from "@/lib/section-pick-scoring"
import { SectionPickExamNotice } from "@/components/section-pick-exam-notice"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"

interface AntiCheatConfig {
  strictModeEnabled: boolean
  blockCopyPaste: boolean
  trackTabSwitches: boolean
  trackMouseMovement: boolean
  warnOnTabSwitch: boolean
  maxTabSwitches: number
  autoSubmitOnViolations: boolean
  trackGeminiWindow?: boolean
  maxGeminiStrikes?: number
  requireFullscreen?: boolean
}

interface QuizInstructionsProps {
  quizId: string
  onStart: (verifiedLocation?: { lat: number; lng: number }, selectedSuperpowers?: SuperpowerId[]) => void
  antiCheatConfig?: AntiCheatConfig
  geoRequired?: boolean
  /** When true, show "Continue Quiz" instead of "Start Quiz" (resuming saved attempt) */
  isResuming?: boolean
  enableSuperpowers?: boolean
  allowedSuperpowers?: SuperpowerId[]
  assessmentType?: string
  /** When false, instructions are still loading - disable Start until ready */
  configLoaded?: boolean
  /** Effective membership tier from parent (Explorer/Trailblazer) - used for superpowers access */
  membershipTier?: MembershipTier
  /** Sections where students pick N questions for grading (from assessment config API) */
  studentPickSections?: StudentPickSectionSummary[]
  sectionPoolSizes?: Record<number, number>
}

export function QuizInstructions({ quizId, onStart, antiCheatConfig, geoRequired, isResuming, enableSuperpowers = false, allowedSuperpowers = [], assessmentType = "quiz", configLoaded = true, membershipTier: membershipTierProp, studentPickSections = [], sectionPoolSizes = {} }: QuizInstructionsProps) {
  const router = useRouter()
  const isNativeApp = useNativeApp()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedSuperpowers, setSelectedSuperpowers] = useState<SuperpowerId[]>([])
  const [superpowersValid, setSuperpowersValid] = useState(true)
  const [membershipTier, setMembershipTier] = useState<MembershipTier>(membershipTierProp || "Scholar")
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const [geminiDetected, setGeminiDetected] = useState(false)
  const [canStart, setCanStart] = useState(false)
  const [isStarting, setIsStarting] = useState(false) // Prevent double-clicks on Start button
  const [locationVerified, setLocationVerified] = useState(false)
  const [verifiedLocation, setVerifiedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false)

  // Stable callback to prevent infinite loops
  const handleGeminiDetected = useCallback((reason: string) => {
    if (!isBrowserAiEnforcementPlatform()) return
    setGeminiDetected(true)
    setCanStart(false)
  }, [])

  // Electron desktop shell has no browser AI side-panels — kiosk mode and
  // app-switch tracking cover it, so never surface browser-AI detection there.
  const trackGeminiOnThisDevice =
    (antiCheatConfig?.trackGeminiWindow ?? false) &&
    isBrowserAiEnforcementPlatform() &&
    !isDesktopElectronAssessmentClient()

  // When student selects No Tab Tracking superpower, skip fullscreen (they need to switch tabs)
  const baseRequireFullscreen = antiCheatConfig?.requireFullscreen ?? false
  const requireFullscreen = baseRequireFullscreen && !selectedSuperpowers.includes("disable_tab_tracking")

  // Callback when AI tool is cleared
  const handleGeminiCleared = useCallback(() => {
    setGeminiDetected(false)
    // Update canStart based on fullscreen (if required), location when geoRequired, and superpowers when enabled
    const isFullscreenActive = isDocumentFullscreen()
    const locationOk = !geoRequired || locationVerified
    const fullscreenOk = !requireFullscreen || isFullscreenActive
    if (configLoaded && fullscreenOk && locationOk && (!enableSuperpowers || superpowersValid)) {
      setCanStart(true)
    }
  }, [geoRequired, locationVerified, requireFullscreen, enableSuperpowers, superpowersValid, configLoaded])

  // Check for Gemini side-panel before allowing quiz start (desktop Windows/macOS only)
  useGeminiDetector({
    enabled: trackGeminiOnThisDevice,
    onDetected: handleGeminiDetected,
    onCleared: handleGeminiCleared,
  })

  // Sync membership tier: prefer prop from parent, then sessionStorage, then fetch when superpowers enabled
  useEffect(() => {
    if (membershipTierProp && ["Explorer", "Trailblazer"].includes(membershipTierProp)) {
      setMembershipTier(membershipTierProp)
      return
    }
    const stored = sessionStorage.getItem("studentMembershipTier") as MembershipTier
    if (stored && ["Explorer", "Trailblazer"].includes(stored)) {
      setMembershipTier(stored)
      return
    }
    if (!enableSuperpowers) {
      setMembershipTier(stored || "Scholar")
      return
    }
    // When superpowers enabled and we don't have Explorer/Trailblazer, fetch from API
    const fetchTier = async () => {
      try {
        let studentDbId = sessionStorage.getItem("studentDatabaseId")
        if (!studentDbId) {
          const studentId = sessionStorage.getItem("studentId")
          if (!studentId) return
          const infoRes = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
          const infoData = await infoRes.json()
          if (infoRes.ok && infoData.student?.id) {
            studentDbId = infoData.student.id.toString()
            sessionStorage.setItem("studentDatabaseId", studentDbId)
            const tier = (infoData.student.membership_tier || "Scholar") as MembershipTier
            if (["Explorer", "Trailblazer"].includes(tier)) {
              setMembershipTier(tier)
              sessionStorage.setItem("studentMembershipTier", tier)
            }
            return
          }
        }
        if (studentDbId) {
          const res = await studentApiFetch(`/api/student/membership?studentId=${studentDbId}`)
          const data = await res.json()
          if (res.ok && data.membership?.tier) {
            const tier = (data.membership.tier || "Scholar") as MembershipTier
            setMembershipTier(tier)
            sessionStorage.setItem("studentMembershipTier", tier)
          }
        }
      } catch (e) {
        console.error("[QuizInstructions] Failed to fetch membership:", e)
      }
    }
    fetchTier()
  }, [membershipTierProp, enableSuperpowers])

  // Check fullscreen status and update canStart accordingly
  useEffect(() => {
    const checkFullscreen = () => {
      const isFullscreenActive = isDocumentFullscreen()

      setIsFullscreen(isFullscreenActive)

      // Update canStart: config loaded, fullscreen (if required), no Gemini, location verified when geoRequired, and superpowers valid when enabled
      const locationOk = !geoRequired || locationVerified
      const fullscreenOk = !requireFullscreen || isFullscreenActive
      const superpowersOk = !enableSuperpowers || superpowersValid
      setCanStart(configLoaded && fullscreenOk && (!trackGeminiOnThisDevice || !geminiDetected) && locationOk && superpowersOk)
    }

    checkFullscreen()

    if (requireFullscreen) {
      return subscribeDocumentFullscreen(checkFullscreen)
    }
  }, [geminiDetected, geoRequired, locationVerified, requireFullscreen, enableSuperpowers, superpowersValid, configLoaded, trackGeminiOnThisDevice])

  const requestFullscreen = async () => {
    const entered = await requestDocumentFullscreen()
    if (!entered) {
      setIsFullscreen(false)
      setCanStart(false)
      setFullscreenError(
        "Failed to enter fullscreen mode. Please allow fullscreen permissions and try again.",
      )
      return
    }

    setIsFullscreen(true)
    setGeminiDetected(false)
    setFullscreenError(null)
    if (!geoRequired || locationVerified) {
      setCanStart(true)
    }
  }

  const handleVerifyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location services are not supported in your browser.")
      return
    }
    setIsVerifyingLocation(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVerifiedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationVerified(true)
        setLocationError(null)
        setIsVerifyingLocation(false)
      },
      (err) => {
        setIsVerifyingLocation(false)
        const msg =
          err.code === 1
            ? "Location access was denied. Please enable location in your browser settings and try again."
            : err.code === 2
            ? "Location unavailable. Please ensure you are in an area with GPS/Wi-Fi signal."
            : "Location request timed out. Please try again."
        setLocationError(msg)
        setLocationVerified(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const handleStartQuiz = () => {
    // CRITICAL: Prevent double-clicks and multiple submissions
    if (isStarting) {
      return
    }

    if (requireFullscreen && !isFullscreen) {
      setFullscreenError("Please enable fullscreen mode before starting the quiz.")
      return
    }

    if (geminiDetected) {
      setFullscreenError("Please close any browser AI tools (like Gemini) before starting the quiz.")
      return
    }

    if (geoRequired && !locationVerified) {
      setLocationError("Please verify your location before starting.")
      return
    }

    // Set loading state immediately to disable button
    setIsStarting(true)

    // Pass verified location and selected superpowers
    const loc = geoRequired && verifiedLocation ? verifiedLocation : undefined
    onStart(loc, enableSuperpowers ? selectedSuperpowers : undefined)
  }

  return (
    <div
      data-quiz-native-root={isNativeApp ? true : undefined}
      className={cn(
        isNativeApp
          ? "native-app-shell overflow-x-hidden overflow-y-auto min-h-full pb-6 bg-[#f8fafc]"
          : "min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900",
      )}
    >
      {!isNativeApp ? <StudentHeader /> : null}

      <div className={cn("max-w-4xl mx-auto", isNativeApp ? "px-3 pt-1 pb-8" : "px-6 pb-12 mt-10")}>
        <Card
          className={cn(
            "border border-slate-200/60 dark:border-slate-600 rounded-2xl overflow-hidden bg-white dark:bg-slate-800",
            isNativeApp ? "shadow-sm" : "shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)] backdrop-blur-sm",
          )}
        >
          {!isNativeApp ? (
            <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60 px-4 sm:px-6 py-5 sm:py-6">
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-3">
                <div className="p-2 bg-purple-100/80 dark:bg-purple-900/80 rounded-xl">
                  <span className="text-xl sm:text-2xl">🧭</span>
                </div>
                <span className="bg-gradient-to-r from-[#582c83] via-[#7a4eba] to-[#eaaa00] dark:from-purple-300 dark:via-indigo-400 dark:to-amber-400 bg-clip-text text-transparent">
                  {assessmentType === "homework" ? "Homework" : assessmentType === "final" ? "Final" : assessmentType === "mid_semester" ? "Exam" : "Quiz"} Instructions
                </span>
              </CardTitle>
              <p className="text-slate-700 dark:text-slate-200 mt-2 text-sm">
                Please read carefully before starting — once you begin, the timer starts immediately.
              </p>
            </CardHeader>
          ) : null}
          <CardContent className={cn(isNativeApp ? "pt-3 px-3 space-y-3" : "pt-5 sm:pt-6 px-4 sm:px-6 space-y-4 sm:space-y-5")}>
            {isNativeApp ? (
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                Review these rules, then start when ready — the timer begins immediately.
              </p>
            ) : null}
            {/* Compact Instructions Grid */}
            <div className={cn("grid grid-cols-1 sm:grid-cols-2", isNativeApp ? "gap-2" : "gap-3 sm:gap-4")}>
              <div className={cn("flex items-start gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600", isNativeApp ? "p-2.5" : "p-3.5 sm:p-4")}>
                <Clock className="h-4 w-4 text-[#582c83] dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-1">Timed Questions</h4>
                  <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    Each question has a time limit. Answers auto-save when time expires.
                  </p>
                </div>
              </div>

              <div className={cn("flex items-start gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600", isNativeApp ? "p-2.5" : "p-4")}>
                <Navigation className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-1">Free Navigation</h4>
                  <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    Navigate between questions freely. Review and flag questions as needed.
                  </p>
                </div>
              </div>

              <div className={cn("flex items-start gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600", isNativeApp ? "p-2.5" : "p-4")}>
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-1">Auto-Save</h4>
                  <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    Answers save automatically. Leaving the page ends the quiz.
                  </p>
                </div>
              </div>

              <div className={cn("flex items-start gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600", isNativeApp ? "p-2.5" : "p-4")}>
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-1">Hints Available</h4>
                  <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    Some questions have hints with a small score penalty.
                  </p>
                </div>
              </div>
            </div>

            {studentPickSections.length > 0 && (
              <SectionPickExamNotice
                sections={studentPickSections}
                poolSizes={sectionPoolSizes}
                variant="instructions"
              />
            )}

            {/* Compact Anti-Cheat Section */}
            {antiCheatConfig && (
              (antiCheatConfig.strictModeEnabled || 
               antiCheatConfig.blockCopyPaste || 
               antiCheatConfig.trackTabSwitches || 
               antiCheatConfig.trackGeminiWindow || 
               antiCheatConfig.trackMouseMovement) && (
              <div className="p-5 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/30">
                <div className="flex items-center gap-2.5 mb-4">
                  <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <h3 className="font-bold text-base text-red-800 dark:text-red-200">⚠️ Anti-Cheat Monitoring Active</h3>
                </div>
                
                <div className="space-y-3 text-sm text-red-700 dark:text-red-300">
                  {/* Restrictions List */}
                  <div className="flex flex-wrap gap-2.5 mb-3">
                    {antiCheatConfig.blockCopyPaste && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 rounded-md text-xs text-red-800 dark:text-red-200">
                        <Copy className="h-3.5 w-3.5" />
                        Copy/Paste disabled
                      </span>
                    )}
                    {antiCheatConfig.trackTabSwitches && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 rounded-md text-xs text-red-800 dark:text-red-200">
                        <Eye className="h-3.5 w-3.5" />
                        Tab switches: Max {antiCheatConfig.maxTabSwitches || 5}
                      </span>
                    )}
                    {trackGeminiOnThisDevice && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 rounded-md text-xs text-red-800 dark:text-red-200">
                        <EyeOff className="h-3.5 w-3.5" />
                        AI tools: Max {antiCheatConfig.maxGeminiStrikes || 5} strikes
                      </span>
                    )}
                    {antiCheatConfig.trackMouseMovement && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 rounded-md text-xs text-red-800 dark:text-red-200">
                        <Monitor className="h-3.5 w-3.5" />
                        Mouse tracking
                      </span>
                    )}
                  </div>

                  {/* Violation Warning */}
                  {antiCheatConfig.autoSubmitOnViolations && (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-900/30 rounded-md border border-amber-200 dark:border-amber-700">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1.5">
                        🚨 Auto-Submit on Violations
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                        Exceeding maximum violations will automatically submit your assessment and redirect you to results.
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-red-600 dark:text-red-400 pt-1">
                    <strong>Note:</strong> All violations are logged and may be reviewed by your instructor.
                  </p>
                </div>
              </div>
            ))}

            {/* Location Required - When assessment has geo restriction */}
            {geoRequired && (
              <div className="p-5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="font-bold text-base text-amber-800 dark:text-amber-200">
                      Location Services Required
                    </h3>
                  </div>
                  {locationVerified && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 rounded-md">
                      <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">Verified</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 leading-relaxed">
                  This assessment can only be taken at a designated location. Please enable location services in your device/browser settings before starting. You will be locked out if location cannot be verified.
                </p>

                {!locationVerified && (
                  <Button
                    onClick={handleVerifyLocation}
                    disabled={isVerifyingLocation}
                    size="sm"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm py-2.5"
                  >
                    {isVerifyingLocation ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Verifying location...
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 mr-2" />
                        Verify My Location
                      </>
                    )}
                  </Button>
                )}

                {locationError && (
                  <div className="mt-3 p-2.5 bg-red-100/50 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-800 dark:text-red-200">{locationError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Compact Fullscreen Requirement - Only when required and not mobile */}
            {requireFullscreen && !isPhoneOrTabletDevice() && (
              <div className="p-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Maximize2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-base text-indigo-800 dark:text-indigo-200">
                    Fullscreen Mode Required
                  </h3>
                </div>
                {isFullscreen && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 rounded-md">
                    <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">Active</span>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-4 leading-relaxed">
                {isDesktopElectronAssessmentClient()
                  ? "Enter fullscreen before you start. If you leave fullscreen, the assessment is blocked until you return — browser AI tools are not used as violations in the desktop app."
                  : "Enter fullscreen before you start. This closes browser side-panels and AI tools. If you leave fullscreen, the assessment is blocked until you return."}
              </p>
              
              {!isFullscreen && (
                <Button
                  onClick={requestFullscreen}
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2.5"
                >
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Enter Fullscreen Mode
                </Button>
              )}

              {fullscreenError && (
                <div className="mt-3 p-2.5 bg-red-100/50 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-800 dark:text-red-200">{fullscreenError}</p>
                </div>
              )}
              </div>
            )}

            {/* Superpowers - only when instructor enabled (like location/fullscreen) */}
            {enableSuperpowers && !isResuming && (
              <SuperpowersSelector
                enabled={enableSuperpowers}
                allowedSuperpowers={allowedSuperpowers}
                membershipTier={membershipTier}
                selectedSuperpowers={selectedSuperpowers}
                onSelectionChange={setSelectedSuperpowers}
                onValidationChange={setSuperpowersValid}
                assessmentLabel={assessmentType === "homework" ? "homework" : assessmentType === "mid_semester" ? "mid-semester" : assessmentType === "final" ? "final" : "quiz"}
              />
            )}

            {geminiDetected && (
              <div className="mt-3 p-2.5 bg-red-100/50 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-800 dark:text-red-200">
                    Browser AI Tool Detected
                  </span>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  Close any browser AI side-panels before starting. Fullscreen mode will close them automatically.
                </p>
              </div>
            )}

            <div className={cn("border-t border-slate-200/60 dark:border-slate-700/60", isNativeApp ? "pt-3 mt-2" : "pt-6 mt-6")}>
              {!isNativeApp ? (
                <p className="text-center text-xs text-slate-600 dark:text-slate-200 mb-5">
                  By clicking {isResuming ? '"Continue Quiz"' : '"Start Quiz"'}, you agree to these rules and confirm you&apos;re ready.
                </p>
              ) : null}
              <Button
                onClick={handleStartQuiz}
                disabled={!configLoaded || isStarting || !canStart || geminiDetected || (geoRequired && !locationVerified) || (enableSuperpowers && !superpowersValid)}
                size="lg"
                className={cn(
                  "w-full rounded-xl transition-colors duration-200",
                  isNativeApp ? "text-base py-5" : "text-lg py-7",
                  configLoaded && canStart && !geminiDetected && !isStarting && (!geoRequired || locationVerified)
                    ? "bg-gradient-to-r from-[#582c83] to-[#7a4eba] hover:from-[#4a2570] hover:to-[#6a459f]"
                    : "bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-60",
                )}
              >
                {!configLoaded
                  ? "⏳ Loading instructions..."
                  : isStarting
                  ? (isResuming ? "⏳ Continuing..." : "⏳ Starting Quiz...")
                  : requireFullscreen && !isFullscreen
                  ? "⚠️ Enable Fullscreen First"
                  : geminiDetected
                  ? "⚠️ Close AI Tools First"
                  : geoRequired && !locationVerified
                  ? "📍 Verify Location First"
                  : (isResuming ? "▶️ Continue Quiz" : "🚀 Start Quiz")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
