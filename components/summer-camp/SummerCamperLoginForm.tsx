"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sun, Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { setStudentSession } from "@/lib/auth"

export function SummerCamperLoginForm() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/summer-camp/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password, fullName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Login failed")

      const s = data.student
      setStudentSession({
        id: String(s.student_id),
        name: String(s.full_name),
        section: "SUMMER_CAMP",
        databaseId: String(s.id),
        isSummerCamper: true,
        studentProgramRole: "summer_camper",
      })

      const onboarded = localStorage.getItem("cc_summer_camp_onboarded")
      router.push(onboarded ? "/summer-camp" : "/summer-camp/onboarding")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-4">
          <Sun className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Summer Camper Login</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Sign in to access your camp trainings, modules, and projects.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="studentId">Camper ID</Label>
          <Input
            id="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Provided by camp admin"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading} style={{ background: "#582c83" }}>
          <LogIn className="h-4 w-4 mr-2" />
          {loading ? "Signing in…" : "Sign in to Summer Camp"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-violet-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to CourseCollab
        </Link>
      </p>
    </div>
  )
}
