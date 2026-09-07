"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, ArrowLeft, Bell, CheckCheck, Sparkles, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { useNotifications } from "@/lib/notification-context"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"

const notificationIcons: Record<string, { icon: any; color: string; bgColor: string }> = {
  quiz: { icon: CheckCheck, color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  practice: { icon: Sparkles, color: "text-emerald-600", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  ai_tutor: { icon: Sparkles, color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  codebench: { icon: CheckCheck, color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  deadline: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
  group: { icon: CheckCheck, color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
  project: { icon: CheckCheck, color: "text-indigo-600", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  homework: { icon: CheckCheck, color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  exam: { icon: CheckCheck, color: "text-pink-600", bgColor: "bg-pink-100 dark:bg-pink-900/30" },
  lecture: { icon: CheckCheck, color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  forum: { icon: CheckCheck, color: "text-violet-600", bgColor: "bg-violet-100 dark:bg-violet-900/30" },
  default: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications()
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const filteredNotifications = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/student/dashboard-v2" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <StudentProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/student/dashboard-v2")}
            className="mb-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Notifications</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up! 🎉"}
                  </p>
                </div>
              </div>
            </div>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <Button 
                  onClick={markAllAsRead} 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </Button>
              </motion.div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")} className="mb-8">
            <TabsList className="rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 p-1">
              <TabsTrigger
                value="all"
                className="rounded-lg px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="rounded-lg px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all"
              >
                Unread {unreadCount > 0 && <span className="ml-1">({unreadCount})</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Notifications */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <div className="inline-flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-lg font-medium">Loading notifications...</span>
                </div>
              </motion.div>
            ) : filteredNotifications.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-16 text-center border-dashed border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-800/50 dark:to-gray-900 rounded-3xl shadow-inner">
                  <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                    <Bell className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">No notifications</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {filter === "unread" ? "You're all caught up! 🎉" : "You don't have any notifications yet."}
                  </p>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="notifications"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {filteredNotifications.map((n, index) => {
                  const iconConfig = notificationIcons[n.type] || notificationIcons.default
                  const IconComponent = iconConfig.icon
                  
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className={cn(
                          "p-6 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg transition-all duration-300 cursor-pointer backdrop-blur-sm group",
                          "hover:-translate-y-1 hover:scale-[1.02]",
                          !n.is_read && "bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-700",
                        )}
                        onClick={() => {
                          markAsRead(n.id)
                          if (n.link) router.push(n.link)
                        }}
                      >
                        <div className="flex gap-4 items-start">
                          <motion.div 
                            className={cn(
                              "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110",
                              iconConfig.bgColor
                            )}
                            whileHover={{ rotate: 5 }}
                          >
                            <IconComponent className={cn("h-6 w-6", iconConfig.color)} />
                          </motion.div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-bold text-lg leading-tight text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {n.title}
                                </h3>
                                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium text-sm">
                                  {n.type}
                                </span>
                              </div>
                              {!n.is_read && (
                                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex-shrink-0 mt-1 animate-pulse" />
                              )}
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed text-base">
                              {n.message}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                              </div>
                              {n.link && (
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                                  View details
                                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  )
}
