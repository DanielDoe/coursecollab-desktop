"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, ArrowLeft, Filter, Trash2, Search } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminNotificationBell } from "@/components/admin-notification-bell"
import { AdminProfileDropdown } from "@/components/admin-profile-dropdown"
import { useAdminNotifications } from "@/lib/admin-notification-context"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

const notificationIcons: Record<string, string> = {
  student_registration: "👤",
  quiz_submission: "✅",
  question_bank: "📝",
  system_alert: "⚠️",
  low_completion: "📉",
  deadline_reminder: "⏰",
  support_request: "💬",
  analytics: "📊",
  playground: "🎮",
  group: "👥",
  project: "📁",
  quiz: "📝",
  grade: "📊",
  default: "📢",
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { notifications, markAsRead, markAllAsRead, isLoading } = useAdminNotifications()
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set())

  const filteredNotifications = notifications
    .filter((n) => (filter === "unread" ? !n.is_read : true))
    .filter((n) => (selectedType === "all" ? true : n.type === selectedType))
    .filter(
      (n) =>
        searchQuery === "" ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase()),
    )

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const notificationTypes = Array.from(new Set(notifications.map((n) => n.type)))

  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set())
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map((n) => n.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedNotifications.size === 0) return

    try {
      const response = await fetch("/api/admin/notifications/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedNotifications) }),
      })

      if (!response.ok) throw new Error("Failed to delete notifications")

      toast({
        title: "Notifications deleted",
        description: `Successfully deleted ${selectedNotifications.size} notification(s).`,
      })

      setSelectedNotifications(new Set())
      window.location.reload()
    } catch (error) {
      console.error("[v0] Failed to delete notifications:", error)
      toast({
        title: "Failed to delete",
        description: "An error occurred while deleting notifications.",
        variant: "destructive",
      })
    }
  }

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete all notifications? This action cannot be undone.")) return

    try {
      const response = await fetch("/api/admin/notifications/clear-all", {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to clear notifications")

      toast({
        title: "All notifications cleared",
        description: "Successfully deleted all notifications.",
      })

      window.location.reload()
    } catch (error) {
      console.error("[v0] Failed to clear notifications:", error)
      toast({
        title: "Failed to clear",
        description: "An error occurred while clearing notifications.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/30 to-background dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80 dark:bg-neutral-900/70">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">CourseCollab Admin</h1>
          </Link>
          <div className="flex items-center gap-2">
            <AdminNotificationBell />
            <AdminProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/dashboard")}
            className="hover:bg-accent/50 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="backdrop-blur-md bg-card/60 border-border/50 rounded-2xl shadow-xl">
              <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                      Admin Notifications
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                      Monitor platform activity, alerts, and submissions in real-time.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-3">
                    <Select value={filter} onValueChange={(value: "all" | "unread") => setFilter(value)}>
                      <SelectTrigger className="w-36 rounded-full bg-muted/40 backdrop-blur">
                        <Filter className="h-4 w-4 mr-2 opacity-70" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                      </SelectContent>
                    </Select>

                    {notifications.some((n) => !n.is_read) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                        onClick={markAllAsRead}
                      >
                        Mark all as read
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="py-16 text-center text-muted-foreground animate-pulse">Loading notifications...</div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <p className="text-lg">No {filter === "unread" ? "unread " : ""}notifications available.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id)
                          if (n.link) router.push(n.link)
                        }}
                        className={cn(
                          "p-5 rounded-2xl border border-border/60 transition-all duration-300 cursor-pointer backdrop-blur-md",
                          "hover:-translate-y-0.5 hover:shadow-md hover:bg-accent/30",
                          !n.is_read && "bg-primary/5 border-primary/20",
                        )}
                      >
                        <div className="flex gap-4">
                          <div className="text-3xl flex-shrink-0">
                            {notificationIcons[n.type] || notificationIcons.default}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h3 className="font-semibold text-base leading-tight text-foreground">{n.title}</h3>
                              {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                            </div>

                            <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{n.message}</p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                              {n.link && <span className="text-primary font-medium hover:underline">View →</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            {/* Statistics */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{notifications.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{unreadCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{notificationTypes.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Management Tools */}
            <Card className="backdrop-blur-md bg-card/60 border-border/50 rounded-2xl shadow-xl">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-xl font-bold">Manage Notifications</CardTitle>
                <CardDescription>Search, filter, and bulk manage your notifications</CardDescription>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* Search and Filter */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search notifications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {notificationTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">
                      {selectedNotifications.size > 0 ? `${selectedNotifications.size} selected` : "Select all"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedNotifications.size > 0 && (
                      <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleClearAll} disabled={notifications.length === 0}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </div>

                {/* Notification List with Checkboxes */}
                <div className="space-y-2">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">No notifications match your filters.</div>
                  ) : (
                    filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border transition-colors",
                          selectedNotifications.has(n.id) && "bg-primary/5 border-primary/30",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNotifications.has(n.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedNotifications)
                            if (e.target.checked) {
                              newSelected.add(n.id)
                            } else {
                              newSelected.delete(n.id)
                            }
                            setSelectedNotifications(newSelected)
                          }}
                          className="h-4 w-4 rounded border-gray-300 mt-1"
                        />
                        <div className="text-2xl flex-shrink-0">
                          {notificationIcons[n.type] || notificationIcons.default}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm">{n.title}</h4>
                            {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                            <span>•</span>
                            <span className="capitalize">{n.type.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
