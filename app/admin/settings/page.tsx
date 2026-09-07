"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, ArrowLeft, Shield, Database, Bell, Users, Lock, Globe, Zap } from "lucide-react"
import { AdminHeader } from "@/components/admin-header"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function AdminSettingsPage() {
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
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">System Settings</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Configure system-wide settings and preferences</p>
              </div>
            </div>
          </div>

          {/* Coming Soon Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
              <CardHeader className="text-center pb-6">
                <motion.div 
                  className="flex justify-center mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <Settings className="h-8 w-8 text-white" />
                  </div>
                </motion.div>
                <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">Coming Soon!</CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                  System settings will be available in a future update
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                    This section will allow you to configure system-wide settings such as default passwords, email
                    notifications, session management, and more.
                  </p>
                </div>

                {/* Feature Preview */}
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="p-6 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Security Settings</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Configure password policies, session timeouts, and security protocols
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Bell className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Notification Settings</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Manage email notifications, alerts, and system announcements
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Database className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Database Settings</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Configure database connections, backups, and maintenance schedules
                    </p>
                  </div>

                  <div className="p-6 rounded-xl bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">User Management</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Set default user roles, permissions, and access controls
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6">
                  <Button 
                    onClick={() => router.push("/admin/dashboard")}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Dashboard
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    disabled
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Enable Settings (Soon)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-gray-100">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  System Information
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Current system status and version information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50">
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">v2.0</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">System Version</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">Online</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">System Status</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white/50 dark:bg-gray-800/50">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">Active</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Database</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
