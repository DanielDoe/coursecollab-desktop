"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { GraduationCap, LogOut, ArrowLeft, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getAdminData, logoutAdmin } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import { getSectionColumnHeading } from "@/lib/instructor-section-presets"
import { useSessionCatalog } from "@/components/session-catalog-provider"

interface TopicAvailability {
  [session: string]: { is_available: boolean; updated_at: string }
}

interface Topic {
  name: string
  question_count: number
  availability: TopicAvailability
}

export default function AdminPracticeHubPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { codes, primaryKpiCodes, labelByCode } = useSessionCatalog()
  const [adminId, setAdminId] = useState<string | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const adminData = getAdminData()
    if (!adminData) {
      router.push("/admin/login")
      return
    }
    setAdminId(adminData.id)
    fetchTopics()
  }, [router])

  const fetchTopics = async () => {
    try {
      const response = await fetch("/api/admin/practice/topics")
      const data = await response.json()

      if (response.ok) {
        setTopics(data.topics)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch topics:", error)
      toast({
        title: "Error",
        description: "Failed to load topics",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAvailability = async (topicName: string, session: string, currentValue: boolean) => {
    const key = `${topicName}-${session}`
    setUpdating(key)

    try {
      const response = await fetch("/api/admin/practice/topics", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": adminId || "",
        },
        body: JSON.stringify({
          topic: topicName,
          session,
          isAvailable: !currentValue,
        }),
      })

      if (response.ok) {
        // Update local state
        setTopics((prev) =>
          prev.map((topic) =>
            topic.name === topicName
              ? {
                  ...topic,
                  availability: {
                    ...topic.availability,
                    [session]: {
                      is_available: !currentValue,
                      updated_at: new Date().toISOString(),
                    },
                  },
                }
              : topic,
          ),
        )

        toast({
          title: "Updated",
          description: `${topicName} ${!currentValue ? "enabled" : "disabled"} for ${session}`,
        })
      } else {
        throw new Error("Failed to update")
      }
    } catch (error) {
      console.error("[v0] Failed to update availability:", error)
      toast({
        title: "Error",
        description: "Failed to update topic availability",
        variant: "destructive",
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleLogout = () => {
    logoutAdmin()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary">
        <header className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <GraduationCap className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">CourseCollab</h1>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Topics</CardDescription>
              <CardTitle className="text-3xl">{topics.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Questions</CardDescription>
              <CardTitle className="text-3xl">{topics.reduce((sum, t) => sum + t.question_count, 0)}</CardTitle>
            </CardHeader>
          </Card>
          {primaryKpiCodes.map((code) => (
            <Card key={code}>
              <CardHeader className="pb-3">
                <CardDescription>{getSectionColumnHeading(code, labelByCode)} — topics enabled</CardDescription>
                <CardTitle className="text-3xl">
                  {topics.filter((t) => t.availability?.[code]?.is_available !== false).length}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Topics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Topic Availability by Session</CardTitle>
            <CardDescription>Toggle to enable or disable topics for each session</CardDescription>
          </CardHeader>
          <CardContent>
            {topics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No topics available. Add questions to the question bank to create topics.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Topic</th>
                      <th className="text-center py-3 px-4 font-semibold">Questions</th>
                      {codes.map((session) => (
                        <th key={session} className="text-center py-3 px-4 font-semibold text-xs max-w-[7rem]">
                          {getSectionColumnHeading(session, labelByCode)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((topic) => (
                      <tr key={topic.name} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{topic.name}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary">{topic.question_count}</Badge>
                        </td>
                        {codes.map((session) => {
                          const isAvailable = topic.availability?.[session]?.is_available ?? true
                          const key = `${topic.name}-${session}`
                          return (
                            <td key={session} className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={isAvailable}
                                  onCheckedChange={() => handleToggleAvailability(topic.name, session, isAvailable)}
                                  disabled={updating === key}
                                />
                                {isAvailable ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Students can only see and practice topics that are enabled for their session</p>
            <p>• Toggle per section (ELEG1301P01, ELEG1304P01, legacy P01, P02, P05, BETA) or use All sessions for everyone</p>
            <p>• Changes take effect immediately for students</p>
            <p>• New topics are automatically enabled for all sessions by default</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
