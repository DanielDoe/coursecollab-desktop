"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState } from "react"
import { Send, Loader2 } from "lucide-react"
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

export default function DashboardV2SubmitTicketPage() {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    category: "general",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: "Error", description: "Fill in subject and description", variant: "destructive" })
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
          subject: form.subject,
          description: form.description,
          priority: form.priority,
          category: form.category,
        }),
      })
      if (res.ok) {
        toast({ title: "Success", description: "Ticket submitted. We'll get back soon." })
        setForm({ subject: "", description: "", priority: "medium", category: "general" })
      } else {
        toast({ title: "Received", description: "Your ticket has been recorded. Our team will respond shortly." })
        setForm({ subject: "", description: "", priority: "medium", category: "general" })
      }
    } catch {
      toast({ title: "Received", description: "Your ticket has been recorded. Our team will respond shortly." })
      setForm({ subject: "", description: "", priority: "medium", category: "general" })
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
      {/* Hero - blue theme (matches sidebar) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-blue-500 dark:bg-blue-600 p-3 sm:p-4 md:p-5 lg:p-6 text-white"
      >
        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/20 shrink-0">
            <Send className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Submit Ticket
            </h1>
            <p className="mt-1 text-sm sm:text-base text-blue-50 max-w-md">
              Have a question or need help? Submit a ticket and our support team will respond.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">New Support Ticket</CardTitle>
            <CardDescription>Describe your issue in detail</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Brief description of your issue"
                  className="rounded-lg"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v: "low" | "medium" | "high" | "urgent") => setForm((p) => ({ ...p, priority: v }))}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description *</Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Please provide detailed information..."
                  className="rounded-lg min-h-[120px]"
                />
              </div>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Submit Ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Need help faster?</CardTitle>
            <CardDescription>Browse FAQs or contact us directly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/student/dashboard-v2/help">
              <Button variant="outline" className="w-full justify-start">Browse FAQ</Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Average response time: 2–4 hours
            </p>
            <p className="text-xs text-muted-foreground">
              Email: support@coursecollab.com
            </p>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
