"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  ChevronRight,
  HelpCircle,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
  facultyToolbarIconButtonClass,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { useToast } from "@/hooks/use-toast"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type HelpSection = { title: string; content: string }

type HelpArticle = {
  id: number
  category: string
  title: string
  content: string
  sections: HelpSection[]
}

type FAQ = {
  id: number
  question: string
  answer: string
}

type HelpData = {
  helpContent: HelpArticle[]
  faqs: FAQ[]
  categories: string[]
  lastUpdated: string
}

function formatCategory(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function FacultyHelpCenterHub() {
  const chrome = facultyEmbedChrome("help-center")
  const spinner = facultyModuleSpinnerClass("help-center")
  const { toast } = useToast()

  const [helpData, setHelpData] = useState<HelpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [view, setView] = useState<"articles" | "faq">("articles")
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)
  const [selectedFaqId, setSelectedFaqId] = useState<number | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [supportForm, setSupportForm] = useState({
    question: "",
    description: "",
    priority: "medium",
  })

  const loadHelp = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await instructorApiFetch("/api/instructor/help-center?category=all")
      if (res.ok) {
        setHelpData(await res.json())
      }
    } catch (error) {
      console.error("Error fetching help content:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadHelp()
  }, [loadHelp])

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (helpData?.helpContent ?? []).filter((item) => {
      const matchesCategory = category === "all" || item.category === category
      if (!matchesCategory) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.sections.some(
          (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q),
        )
      )
    })
  }, [helpData, category, search])

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (helpData?.faqs ?? []).filter((faq) => {
      if (!q) return true
      return faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    })
  }, [helpData, search])

  const selectedArticle =
    filteredArticles.find((a) => a.id === selectedArticleId) ??
    helpData?.helpContent.find((a) => a.id === selectedArticleId) ??
    null

  const selectedFaq =
    filteredFaqs.find((f) => f.id === selectedFaqId) ??
    helpData?.faqs.find((f) => f.id === selectedFaqId) ??
    null

  useEffect(() => {
    if (view === "articles") {
      setSelectedArticleId((prev) => {
        if (prev != null && filteredArticles.some((a) => a.id === prev)) return prev
        return filteredArticles[0]?.id ?? null
      })
    } else {
      setSelectedFaqId((prev) => {
        if (prev != null && filteredFaqs.some((f) => f.id === prev)) return prev
        return filteredFaqs[0]?.id ?? null
      })
    }
  }, [view, filteredArticles, filteredFaqs])

  const submitSupport = async () => {
    if (!supportForm.question.trim()) {
      toast({ title: "Add a brief subject", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await instructorApiFetch("/api/instructor/help-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supportForm),
      })
      if (!res.ok) throw new Error("submit failed")
      setSupportOpen(false)
      setSupportForm({ question: "", description: "", priority: "medium" })
      toast({ title: "Support request sent", description: "We'll follow up as soon as we can." })
    } catch {
      toast({ title: "Could not submit request", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const activeFilterCount = (category !== "all" ? 1 : 0) + (search.trim() ? 1 : 0)
  const listCount = view === "articles" ? filteredArticles.length : filteredFaqs.length

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={cn("h-8 w-8 animate-spin", spinner)} />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={chrome.iconBadge("md")}>
          <HelpCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Student support</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Browse faculty guides and FAQs, or contact support from the toolbar.
          </p>
        </div>
      </div>

      <FacultyIntegratedToolbar
        moduleId="help-center"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search articles and FAQs…"
        filters={
          <>
            <Select value={view} onValueChange={(v) => setView(v as "articles" | "faq")}>
              <SelectTrigger className={facultyToolbarSelectTriggerClass()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="articles">Articles</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
              </SelectContent>
            </Select>
            {view === "articles" ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(category !== "all"), "w-[7rem] sm:w-[8rem]")}>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {(helpData?.categories ?? []).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {formatCategory(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={facultyToolbarIconButtonClass()}
              aria-label="Refresh help content"
              title="Refresh"
              disabled={refreshing}
              onClick={() => void loadHelp(true)}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("h-9 gap-1.5 rounded-lg", chrome.cta)}
              onClick={() => setSupportOpen(true)}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Contact support</span>
            </Button>
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {listCount} {view === "articles" ? "article" : "question"}
            {listCount === 1 ? "" : "s"}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : ""}
          </p>
        }
      />

      {listCount === 0 ? (
        <div className={cn(PORTAL_CARD, "px-6 py-14 text-center")}>
          <HelpCircle className={cn("mx-auto mb-3 h-8 w-8 opacity-40", PORTAL_TEXT_MUTED)} />
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Nothing matches</p>
          <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
            Try another search or use Contact support in the toolbar.
          </p>
        </div>
      ) : (
        <div className="grid min-h-[26rem] grid-cols-1 gap-3 lg:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] lg:gap-4">
          <div className={cn(PORTAL_CARD, "overflow-hidden p-1.5")}>
            <ul className="max-h-[min(520px,68vh)] space-y-0.5 overflow-y-auto">
              {view === "articles"
                ? filteredArticles.map((article) => {
                    const active = article.id === selectedArticleId
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedArticleId(article.id)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                            active
                              ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                              : "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/45 hover:text-[var(--cc-text)]",
                          )}
                        >
                          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-medium leading-snug">{article.title}</p>
                            <p className="mt-0.5 text-[11px] capitalize opacity-70">{formatCategory(article.category)}</p>
                          </div>
                          {active ? <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-60" /> : null}
                        </button>
                      </li>
                    )
                  })
                : filteredFaqs.map((faq) => {
                    const active = faq.id === selectedFaqId
                    return (
                      <li key={faq.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedFaqId(faq.id)}
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                            active
                              ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)]"
                              : "text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/45 hover:text-[var(--cc-text)]",
                          )}
                        >
                          <p className="line-clamp-3 text-sm font-medium leading-snug">{faq.question}</p>
                        </button>
                      </li>
                    )
                  })}
            </ul>
          </div>

          <div className={cn(PORTAL_CARD, "min-h-[26rem] overflow-y-auto p-4 sm:p-5")}>
            {view === "articles" && selectedArticle ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-[var(--cc-accent)]/35 capitalize">
                    {formatCategory(selectedArticle.category)}
                  </Badge>
                  <h2 className={cn("text-base font-semibold leading-snug sm:text-lg", PORTAL_TEXT)}>
                    {selectedArticle.title}
                  </h2>
                  <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{selectedArticle.content}</p>
                </div>
                {selectedArticle.sections.length > 0 ? (
                  <div className="space-y-3">
                    {selectedArticle.sections.map((section) => (
                      <div
                        key={section.title}
                        className="rounded-lg border-l-2 border-[var(--cc-accent)]/40 bg-[var(--sidebar-accent)]/20 px-3 py-2.5"
                      >
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{section.title}</p>
                        <p className={cn("mt-1 text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{section.content}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : view === "faq" && selectedFaq ? (
              <div className="space-y-3">
                <h2 className={cn("text-base font-semibold leading-snug sm:text-lg", PORTAL_TEXT)}>
                  {selectedFaq.question}
                </h2>
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{selectedFaq.answer}</p>
              </div>
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select an item from the list</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b border-[var(--border)] px-5 py-4">
            <DialogTitle className={PORTAL_TEXT}>Contact support</DialogTitle>
            <DialogDescription className={PORTAL_TEXT_MUTED}>
              Describe your issue and we&apos;ll get back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)} htmlFor="support-subject">
                Subject
              </label>
              <Input
                id="support-subject"
                placeholder="Brief summary"
                value={supportForm.question}
                onChange={(e) => setSupportForm((p) => ({ ...p, question: e.target.value }))}
                className="h-9 rounded-lg border-0 bg-[var(--sidebar-accent)]/40 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/35"
              />
            </div>
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)} htmlFor="support-details">
                Details
              </label>
              <Textarea
                id="support-details"
                placeholder="What happened? Include steps to reproduce if relevant."
                value={supportForm.description}
                onChange={(e) => setSupportForm((p) => ({ ...p, description: e.target.value }))}
                rows={4}
                className="min-h-[5.5rem] resize-none rounded-lg border-0 bg-[var(--sidebar-accent)]/40 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/35"
              />
            </div>
            <div className="space-y-1.5">
              <label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)} htmlFor="support-priority">
                Priority
              </label>
              <Select
                value={supportForm.priority}
                onValueChange={(value) => setSupportForm((p) => ({ ...p, priority: value }))}
              >
                <SelectTrigger
                  id="support-priority"
                  className={cn(facultyToolbarSelectTriggerClass(), "h-9 w-full")}
                >
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
          <DialogFooter className="gap-2 border-t border-[var(--border)] px-5 py-4">
            <Button type="button" variant="ghost" className={facultyToolbarFilterButtonClass()} onClick={() => setSupportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className={cn("gap-2 rounded-lg", chrome.cta)} disabled={submitting} onClick={() => void submitSupport()}>
              {submitting ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Send className="h-4 w-4" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
