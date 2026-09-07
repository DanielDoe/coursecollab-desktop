"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Sparkles, Heart, Zap, Crown, Gift, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StudentHeader } from "@/components/student-header"
import { motion } from "framer-motion"
import Link from "next/link"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"

export default function StudentUpgradePage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    setStudentId(id || null)
  }, [])

  const explorerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")
  const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            onClick={() => router.back()}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
              Unlock Assessment Retakes
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Get the ability to retake quizzes and homework assignments. Mid-semester exams and finals are always single-attempt.
            </p>
          </div>
        </motion.div>

        {/* Donation Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-2 border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-lg">
                  <Heart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                </div>
                <CardTitle className="text-2xl">Support CourseCollab</CardTitle>
              </div>
              <CardDescription className="text-base">
                Donate any amount to unlock 14 days of premium access including retakes!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">2 Retakes (3 total attempts) on all assessments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">14 days of Trailblazer-level access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">Unlimited Cora access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">Unlimited Playground credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">Early access to new features</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">Save and Finish Later</span>
                </div>
              </div>
              <Button
                onClick={() => router.push("/student/trade-center")}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white"
                size="lg"
              >
                <Gift className="h-5 w-5 mr-2" />
                Donate Now
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Membership Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Explorer Plan */}
          {explorerPlan && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-2 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-2xl">{explorerPlan.displayName}</CardTitle>
                    <Badge className="bg-blue-600 text-white">{explorerPlan.badge}</Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">${(explorerPlan.priceInCents / 100).toFixed(2)}</span>
                    <span className="text-slate-600 dark:text-slate-400">/month</span>
                  </div>
                  <CardDescription>{explorerPlan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>{explorerPlan.features.quizAttempts} quiz attempts (2 retakes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>Save and Finish Later</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>Access to lectures</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>Leaderboard access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>{explorerPlan.features.aiTutor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <span>{explorerPlan.features.playgroundCredits} playground credits/week</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push("/student/membership/upgrade")}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    Upgrade to Explorer
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Trailblazer Plan */}
          {trailblazerPlan && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="h-full border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:shadow-lg transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg">
                  <Star className="h-4 w-4 inline mr-1" />
                  Best Value
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-2xl">{trailblazerPlan.displayName}</CardTitle>
                    <Badge className="bg-purple-600 text-white">{trailblazerPlan.badge}</Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">${(trailblazerPlan.priceInCents / 100).toFixed(2)}</span>
                    <span className="text-slate-600 dark:text-slate-400">/month</span>
                  </div>
                  <CardDescription>{trailblazerPlan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>{trailblazerPlan.features.quizAttempts} quiz attempts (2 retakes)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>Save and Finish Later</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>Access to lectures</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>Leaderboard access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>{trailblazerPlan.features.aiTutor} Cora</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>CodeBench access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>Early access to features</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span>Unlimited playground credits</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push("/student/membership/upgrade")}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    size="lg"
                  >
                    <Crown className="h-5 w-5 mr-2" />
                    Upgrade to Trailblazer
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-slate-50 dark:bg-slate-800/50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Why Upgrade?
                </h3>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Retake quizzes, homeworks, mid-semester exams, and finals to improve your scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Learn from mistakes and master the material at your own pace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Access advanced features like Cora and CodeBench</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Support the platform and help us continue improving CourseCollab</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

