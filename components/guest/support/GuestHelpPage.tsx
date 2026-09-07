"use client"

import { useState } from "react"
import {
  HelpCircle,
  Search,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
} from "lucide-react"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { GUEST_FAQ_ITEMS } from "@/components/guest/support/guest-support-faq"

export function GuestHelpPage() {
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = GUEST_FAQ_ITEMS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-5 md:space-y-6 w-full min-w-0 pb-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-slate-600 dark:bg-slate-500 p-3 sm:p-4 md:p-5 lg:p-6 text-white"
      >
        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/20 shrink-0">
            <HelpCircle className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Help & Support</h1>
            <p className="mt-1 text-sm sm:text-base text-slate-100 max-w-md">
              Find answers in our FAQs or reach out via Submit Ticket in the sidebar.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl border shadow-sm bg-card overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-500/20 dark:bg-slate-400/20">
                <BookOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Frequently Asked Questions</CardTitle>
                <CardDescription>Common questions and answers</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.map((f) => {
                  const open = expandedId === f.id
                  return (
                    <motion.div key={f.id} layout className="rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : f.id)}
                        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm font-medium truncate">{f.q}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">
                            {f.cat}
                          </Badge>
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border"
                          >
                            <p className="p-3 text-sm text-muted-foreground">{f.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-xl border shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Contact</CardTitle>
              <CardDescription>Reach out for help</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">support@coursecollab.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Live Chat</p>
                  <p className="text-sm font-medium">Available 24/7</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
