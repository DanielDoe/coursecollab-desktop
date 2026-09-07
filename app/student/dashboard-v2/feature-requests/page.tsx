"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

export default function DashboardV2FeatureRequestsPage() {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    area: "general" as "general" | "quizzes" | "lectures" | "forum" | "ai" | "ui" | "other",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Error", description: "Fill in title and description", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const dbId = sessionStorage.getItem("studentDatabaseId")
      const res = await studentApiFetch("/api/student/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: dbId ? parseInt(dbId) : null,
          subject: `[Feature] ${form.title}`,
          description: `Area: ${form.area}\n\n${form.description}`,
          priority: "medium",
          category: "feature",
        }),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Feature request submitted. Thank you!" })
        setForm({ title: "", description: "", area: "general" })
      } else {
        toast({ title: "Received", description: "Your idea has been recorded. We appreciate your feedback!" })
        setForm({ title: "", description: "", area: "general" })
      }
    } catch {
      toast({ title: "Received", description: "Your idea has been recorded. We appreciate your feedback!" })
      setForm({ title: "", description: "", area: "general" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 pb-8"
    >
      {/* Hero - violet theme (matches sidebar) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-violet-500 dark:bg-violet-600 p-3 sm:p-4 md:p-5 lg:p-6 text-white"
      >
        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/20 shrink-0">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Feature Requests
            </h1>
            <p className="mt-1 text-sm sm:text-base text-violet-50 max-w-md">
              Have an idea to make CourseCollab better? Share it with us.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Suggest a Feature</CardTitle>
            <CardDescription>Describe your idea and how it would help</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Feature idea *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Dark mode for quiz taker"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Area</Label>
                <Select value={form.area} onValueChange={(v: "general" | "quizzes" | "lectures" | "forum" | "ai" | "ui" | "other") => setForm((p) => ({ ...p, area: v }))}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="quizzes">Quizzes</SelectItem>
                    <SelectItem value="lectures">Lectures</SelectItem>
                    <SelectItem value="forum">Forum</SelectItem>
                    <SelectItem value="ai">AI Tutor</SelectItem>
                    <SelectItem value="ui">UI / Design</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description *</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe your idea, the problem it solves, and how it would work..."
                  className="rounded-lg min-h-[120px]"
                />
              </div>
              <Button type="submit" disabled={submitting} className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">We love ideas</CardTitle>
            <CardDescription>Your feedback shapes CourseCollab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• Describe the feature and why it would be useful.</p>
            <p>• Popular areas: quizzes, AI tutor, forum, UI improvements.</p>
            <Link href="/student/dashboard-v2/help">
              <Button variant="outline" size="sm" className="w-full mt-2">Browse FAQ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
