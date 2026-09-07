"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Phone, Clock, HelpCircle, Users, Settings, BookOpen, Shield, Zap, ArrowLeft, MessageSquare, Database, BarChart3 } from "lucide-react"
import { AdminHeader } from "@/components/admin-header"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function AdminHelpPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if admin is logged in
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto space-y-8"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <HelpCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Help & Support</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Administrator resources and support information</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  Technical Support
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400">Contact IT support for technical assistance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Email</p>
                      <a href="mailto:support@example.edu" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline text-lg font-medium">
                        support@example.edu
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Support Phone</p>
                      <a href="tel:+1234567890" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline text-lg font-medium">
                        (123) 456-7890
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Office Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  Support Hours
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400">When technical support is available</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-700">
                  <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-base text-blue-900 dark:text-blue-200">
                    Technical support is available Monday-Friday, 8:00 AM - 5:00 PM. For urgent issues outside these
                    hours, please email support and mark as urgent.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </motion.div>

          {/* Admin FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  Administrator FAQ
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400">Common administrative tasks and questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="p-6 rounded-xl bg-gradient-to-r from-gray-50/50 to-slate-50/50 dark:from-gray-800/50 dark:to-slate-800/50">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    How do I add or manage students?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    Navigate to the "Student Management" section from your dashboard. You can add individual students or
                    import them in bulk using a CSV file. Make sure to assign students to the correct section/session.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    How do I create and manage quizzes?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    Go to "Quiz Management" from your dashboard. You can create new quizzes, add questions, set time
                    limits, and activate/deactivate quizzes. Students can only access active quizzes.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    How do I manage groups and projects?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    Use the "Groups Manager" to create groups and assign students. You can then create projects for each
                    group and track their progress through the "Projects Management" section.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    How do I reset a student's password?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    In the "Student Management" section, find the student and use the "Reset Password" option. This will
                    reset their password to the default (<code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono text-sm">ELEG2025!</code>
                    ) and require them to change it on next login.
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-indigo-900/20 dark:to-blue-900/20">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    How do I view quiz results and analytics?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                    Quiz results are available in the "Quiz Management" section. Click on any quiz to view detailed
                    results, including individual student performance, question-level analytics, and overall statistics.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400">Common administrative tasks and helpful links</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-xl border-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 justify-start"
                    onClick={() => router.push("/admin/students")}
                  >
                    <Users className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-semibold">Student Management</div>
                      <div className="text-sm text-gray-500">Manage student accounts</div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 justify-start"
                    onClick={() => router.push("/admin/quizzes")}
                  >
                    <BookOpen className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-semibold">Quiz Management</div>
                      <div className="text-sm text-gray-500">Create and manage quizzes</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-16 rounded-xl border-2 hover:bg-green-50 dark:hover:bg-green-900/30 justify-start"
                    onClick={() => router.push("/admin/analytics")}
                  >
                    <BarChart3 className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-semibold">Analytics Dashboard</div>
                      <div className="text-sm text-gray-500">View system analytics</div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="h-16 rounded-xl border-2 hover:bg-purple-50 dark:hover:bg-purple-900/30 justify-start"
                    onClick={() => router.push("/admin/settings")}
                  >
                    <Settings className="h-5 w-5 mr-3" />
                    <div className="text-left">
                      <div className="font-semibold">System Settings</div>
                      <div className="text-sm text-gray-500">Configure system settings</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
