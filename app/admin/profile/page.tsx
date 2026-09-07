"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, User, Mail, Shield, ArrowLeft } from "lucide-react"
import { AdminHeader } from "@/components/admin-header"
import { toast } from "@/lib/app-toast"
import { motion } from "framer-motion"

export default function AdminProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
  })

  useEffect(() => {
    // Check if admin is logged in
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    const loadAdminData = async () => {
      try {
        const response = await fetch(`/api/admin/profile?adminId=${adminId}`)
        if (response.ok) {
          const data = await response.json()
          setFormData({
            username: data.admin.username || "",
            email: data.admin.email || "",
          })
        }
      } catch (error) {
        console.error("Failed to load admin data:", error)
      }
    }

    loadAdminData()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    // Validate username
    if (!formData.username.trim()) {
      setError("Username is required")
      return
    }

    if (formData.username.trim().length < 3) {
      setError("Username must be at least 3 characters")
      return
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)

    try {
      const adminId = sessionStorage.getItem("adminId")

      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId,
          username: formData.username.trim(),
          email: formData.email.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile")
      }

      // Update sessionStorage with new data
      sessionStorage.setItem("adminUsername", formData.username.trim())

      setSuccess(true)
      toast.success("Profile updated successfully!")

      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        router.push("/admin/dashboard")
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      toast.error("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/dashboard")}
            className="mb-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Button>

          <Card className="border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl">
            <CardHeader className="text-center pb-6">
              <motion.div 
                className="flex justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <User className="h-8 w-8 text-white" />
                </div>
              </motion.div>
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Profile</CardTitle>
              <CardDescription className="text-lg text-gray-600 dark:text-gray-400 mt-2">
                Update your administrator information and account settings
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
                      Profile updated successfully! Redirecting to dashboard...
                    </AlertDescription>
                  </Alert>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="username" className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                      disabled={loading}
                      className="py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white/50 dark:bg-gray-800/50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">This is your administrator username for logging in</p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={loading}
                      className="py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white/50 dark:bg-gray-800/50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Optional: Your email address for notifications</p>
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
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all py-3"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Save Changes
                        </div>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/dashboard")}
                      disabled={loading}
                      className="flex-1 rounded-xl border-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
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
