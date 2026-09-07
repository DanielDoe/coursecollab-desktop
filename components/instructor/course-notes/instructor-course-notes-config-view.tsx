"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { Loader2, Users } from "lucide-react"
import { toast } from "@/lib/app-toast"

type ConfigSection = {
  code: string
  studentCount: number
}

type ConfigTopic = {
  name: string
  note_count: number
  availability: Record<string, { is_available: boolean; configured: boolean }>
}

export function InstructorCourseNotesConfigView() {
  const chrome = facultyEmbedChrome("course-notes")
  const [loading, setLoading] = useState(true)
  const [sections, setSections] = useState<ConfigSection[]>([])
  const [topics, setTopics] = useState<ConfigTopic[]>([])
  const [search, setSearch] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all")

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadConfiguration = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/configuration", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load configuration")
      setSections(data.sections || [])
      setTopics(data.topics || [])
    } catch (err: unknown) {
      toast.error("Could not load note configuration", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfiguration()
  }, [loadConfiguration])

  const toggleTopic = async (topicName: string, sessionCode: string, currentValue: boolean) => {
    try {
      const res = await instructorApiFetch("/api/instructor/course-notes/topics/toggle", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          topicName,
          session: sessionCode,
          isAvailable: !currentValue,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Toggle failed")
      }
      await loadConfiguration()
      const label = sessionCode === "ALL" ? "all sections" : sessionCode
      toast.success(
        !currentValue
          ? `"${topicName}" enabled for ${label}`
          : `"${topicName}" hidden from ${label}`,
      )
    } catch (err: unknown) {
      toast.error("Could not update availability", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const sectionKeys = useMemo(
    () => ["ALL", ...[...new Set(sections.map((s) => s.code))]],
    [sections],
  )

  const filteredTopics = useMemo(() => {
    const term = search.trim().toLowerCase()
    return topics.filter((topic) => {
      if (term && !topic.name.toLowerCase().includes(term)) return false
      if (visibilityFilter === "all") return true
      const allVisible = topic.availability.ALL?.is_available ?? true
      return visibilityFilter === "visible" ? allVisible : !allVisible
    })
  }, [topics, search, visibilityFilter])

  return (
    <div className="space-y-3 min-w-0">
      <FacultyIntegratedToolbar
        moduleId="course-notes"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search topics…"
        filters={
          <Select
            value={visibilityFilter}
            onValueChange={(v) => setVisibilityFilter(v as typeof visibilityFilter)}
          >
            <SelectTrigger className={facultyToolbarSelectTriggerClass(visibilityFilter !== "all")}>
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              <SelectItem value="visible">Visible</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredTopics.length} topic{filteredTopics.length === 1 ? "" : "s"} · {sections.length} section
            {sections.length === 1 ? "" : "s"}
          </p>
        }
      />

      {loading ? (
        <div className={cn(PORTAL_CARD, "flex min-h-[200px] items-center justify-center")}>
          <Loader2 className={cn("h-6 w-6 animate-spin", chrome.p.iconText)} />
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className={cn(PORTAL_CARD, "rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground")}>
          {topics.length === 0
            ? "Add notes with topics first — section access controls appear here once topics exist."
            : "No topics match your search."}
        </div>
      ) : sections.length === 0 ? (
        <div className="space-y-3">
          <div className={cn(PORTAL_CARD, "rounded-xl border border-dashed border-amber-200/80 bg-amber-50/40 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/20 dark:text-amber-200")}>
            No academic sections found. Add sections under Course → Academic Terms.
          </div>
          {filteredTopics.map((topic) => (
            <TopicSectionRow
              key={topic.name}
              topic={topic}
              sectionKeys={["ALL"]}
              sections={[]}
              onToggle={toggleTopic}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic) => (
            <TopicSectionRow
              key={topic.name}
              topic={topic}
              sectionKeys={sectionKeys}
              sections={sections}
              onToggle={toggleTopic}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TopicSectionRow({
  topic,
  sectionKeys,
  sections,
  onToggle,
}: {
  topic: ConfigTopic
  sectionKeys: string[]
  sections: ConfigSection[]
  onToggle: (topicName: string, sessionCode: string, currentValue: boolean) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--sidebar-accent)]/20 px-3 py-2.5">
        <p className="font-medium text-sm flex-1 min-w-0">{topic.name}</p>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {topic.note_count} note{topic.note_count === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {sectionKeys.map((code, index) => {
          const avail = topic.availability[code]
          const isAvailable = avail?.is_available ?? true
          const sectionMeta = sections.find((s) => s.code === code)
          const isAll = code === "ALL"

          return (
            <div
              key={`${topic.name}-${code}-${index}`}
              className={cn(
                "flex flex-wrap items-center gap-3 px-3 py-2.5",
                !isAvailable && "bg-[var(--sidebar-accent)]/10",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{isAll ? "All sections" : code}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAll
                    ? "Course-wide default for this topic"
                    : sectionMeta
                      ? `${sectionMeta.studentCount} student${sectionMeta.studentCount === 1 ? "" : "s"}`
                      : "Section cohort"}
                </p>
              </div>
              {!isAll && sectionMeta ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Users className="h-3 w-3" />
                  {sectionMeta.studentCount}
                </span>
              ) : null}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {isAvailable ? "On" : "Off"}
                </span>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={() => void onToggle(topic.name, code, isAvailable)}
                  aria-label={`${topic.name} for ${isAll ? "all sections" : code}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
