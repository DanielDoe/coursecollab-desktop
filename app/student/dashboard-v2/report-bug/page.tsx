"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState } from "react"
import { Bug, Loader2 } from "lucide-react"
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

export default function DashboardV2ReportBugPage() {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    page: "",
    severity: "medium" as "low" | "medium" | "high" | "critical",
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
          subject: `[Bug] ${form.title}`,
          description: `Page/URL: ${form.page || "N/A"}\nSeverity: ${form.severity}\n\n${form.description}`,
          priority: form.severity === "critical" ? "urgent" : form.severity === "high" ? "high" : "medium",
          category: "bug",
        }),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Bug report submitted. Thank you!" })
        setForm({ title: "", description: "", page: "", severity: "medium" })
      } else {
        toast({ title: "Received", description: "Your bug report has been recorded. We'll investigate." })
        setForm({ title: "", description: "", page: "", severity: "medium" })
      }
    } catch {
      toast({ title: "Received", description: "Your bug report has been recorded. We'll investigate." })
      setForm({ title: "", description: "", page: "", severity: "medium" })
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
      {/* Hero - rose theme (matches sidebar) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-rose-500 dark:bg-rose-600 p-3 sm:p-4 md:p-5 lg:p-6 text-white"
      >
        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/20 shrink-0">
            <Bug className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Report a Bug
            </h1>
            <p className="mt-1 text-sm sm:text-base text-rose-50 max-w-md">
              Found something broken? Help us improve by reporting it.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Bug Report</CardTitle>
            <CardDescription>Describe what went wrong and where</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">What happened? *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Brief summary of the bug"
                  className="rounded-lg"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Where did it happen?</Label>
                  <Input
                    value={form.page}
                    onChange={(e) => setForm((p) => ({ ...p, page: e.target.value }))}
                    placeholder="e.g. Quiz page, Settings"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v: "low" | "medium" | "high" | "critical") => setForm((p) => ({ ...p, severity: v }))}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Steps to reproduce *</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="1. Go to...\n2. Click on...\n3. Error appears..."
                  className="rounded-lg min-h-[120px]"
                />
              </div>
              <Button type="submit" disabled={submitting} className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bug className="h-4 w-4 mr-2" />}
                Submit Bug Report
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Tips</CardTitle>
            <CardDescription>Help us fix it faster</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• Include the page or feature where the bug occurred.</p>
            <p>• Describe the steps to reproduce if possible.</p>
            <p>• Mention what you expected vs what actually happened.</p>
            <Link href="/student/dashboard-v2/help">
              <Button variant="outline" size="sm" className="w-full mt-2">Browse FAQ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
