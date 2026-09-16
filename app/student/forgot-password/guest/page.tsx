"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, GraduationCap, KeyRound, CheckCircle2, Clock, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function GuestForgotPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const response = await fetch("/api/guest/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit")
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
        <header className="border-b border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/student/login/guest" className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-violet-600">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Career Member sign in</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 border border-violet-200/80 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm font-bold hidden sm:inline">CourseCollab</span>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-8 shadow-lg">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-center mb-2">Request sent</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
              Your instructor can approve the reset from their dashboard. After approval, you will receive a temporary
              password at the email you entered (or they may share it with you directly).
            </p>
            <Alert className="mb-6 rounded-xl border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/30">
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Use the temporary password to sign in on the Career Member page, then open Profile to set a new password if you
                like.
              </AlertDescription>
            </Alert>
            <Button className="w-full rounded-xl bg-violet-600 hover:bg-violet-700" onClick={() => router.push("/student/login/guest")}>
              Back to Career Member sign in
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <header className="border-b border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/student/login/guest" className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-violet-600">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Career Member sign in</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 border border-violet-200/80 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-6 sm:p-8 shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-violet-500/15 flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-center mb-1">Forgot password</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
            Submit a request so your instructor can reset your Career Member password and send you a temporary password.
          </p>
          <Alert className="mb-6 rounded-xl">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              Use the same email and full name you used when you created your Career Member account.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-email">Email</Label>
              <Input
                id="g-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="rounded-xl"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-name">Full name</Label>
              <Input
                id="g-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="rounded-xl"
                autoComplete="name"
                placeholder="As registered on your Career Member account"
              />
            </div>
            {error ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full rounded-xl bg-violet-600 hover:bg-violet-700" disabled={loading}>
              {loading ? "Submitting…" : "Submit request"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
