"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Flame,
  Target,
  BookOpen,
  Trophy,
  Zap
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalAccentIconClass } from "@/lib/portal-module-themes"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")

interface SmartNotification {
  id: string
  type: 'reminder' | 'achievement' | 'warning' | 'suggestion'
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
}

interface SmartLearningNotificationsProps {
  studentId: string
  topicProgress: any[]
  embedInDashboard?: boolean
}

export function SmartLearningNotifications({
  studentId,
  topicProgress,
  embedInDashboard = false,
}: SmartLearningNotificationsProps) {
  const [notifications, setNotifications] = useState<SmartNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(true)

  useEffect(() => {
    generateSmartNotifications()
  }, [topicProgress])

  const generateSmartNotifications = () => {
    const newNotifications: SmartNotification[] = []

    // Check for topics not practiced recently
    topicProgress.forEach(topic => {
      const daysSince = Math.floor((Date.now() - new Date(topic.lastPracticed).getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSince >= 7) {
        newNotifications.push({
          id: `reminder-${topic.topic}`,
          type: 'reminder',
          title: `Practice ${topic.topic}`,
          message: `You haven't practiced ${topic.topic} in ${daysSince} days. Regular practice helps retention!`,
          priority: 'medium',
          createdAt: new Date(),
          action: {
            label: 'Practice Now',
            onClick: () => console.log('Practice', topic.topic)
          }
        })
      }

      // Warning for declining topics
      if (topic.trend === 'declining' && topic.mastery < 50) {
        newNotifications.push({
          id: `warning-${topic.topic}`,
          type: 'warning',
          title: `${topic.topic} Needs Attention`,
          message: `Your ${topic.topic} mastery is declining. Focus on this topic to prevent falling behind.`,
          priority: 'high',
          createdAt: new Date(),
          action: {
            label: 'Review Now',
            onClick: () => console.log('Review', topic.topic)
          }
        })
      }

      // Achievement for mastery
      if (topic.mastery >= 80 && topic.mastery < 85) {
        newNotifications.push({
          id: `achievement-${topic.topic}`,
          type: 'achievement',
          title: `Almost Mastered ${topic.topic}!`,
          message: `You're at ${topic.mastery}% mastery. Just a bit more practice to reach expert level!`,
          priority: 'low',
          createdAt: new Date()
        })
      }
    })

    // Streak reminder
    const lastPracticeDate = new Date(Math.max(...topicProgress.map(t => new Date(t.lastPracticed).getTime())))
    const hoursSinceLastPractice = (Date.now() - lastPracticeDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLastPractice > 24 && hoursSinceLastPractice < 48) {
      newNotifications.push({
        id: 'streak-reminder',
        type: 'suggestion',
        title: 'Keep Your Streak Alive!',
        message: `Don't break your learning streak! Ask the AI tutor a question to maintain momentum.`,
        priority: 'medium',
        createdAt: new Date(),
        action: {
          label: 'Ask Question',
          onClick: () => window.location.href = '/student/ai-tutor/chat'
        }
      })
    }

    setNotifications(newNotifications)
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reminder': return <Clock className="w-5 h-5 text-blue-500" />
      case 'achievement': return <Trophy className="w-5 h-5 text-yellow-500" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'suggestion': return <Zap className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
      default: return <Bell className="w-5 h-5" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'reminder': return 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25 dark:border-blue-500/30'
      case 'achievement': return 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25 dark:border-amber-500/30'
      case 'warning': return 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 dark:border-rose-500/30'
      case 'suggestion': return cn(aiTutorTheme.page.softBg, aiTutorTheme.page.border)
      default: return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
    }
  }

  if (!showNotifications || notifications.length === 0) {
    return null
  }

  const visible = embedInDashboard ? notifications.slice(0, 2) : notifications

  if (embedInDashboard) {
    return (
      <div className="space-y-2">
        {visible.map((notification) => (
          <div
            key={notification.id}
            className="flex gap-3 rounded-xl bg-[var(--muted)]/30 px-3 py-2.5"
          >
            <div className="shrink-0 pt-0.5">{getNotificationIcon(notification.type)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--cc-text)]">{notification.title}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissNotification(notification.id)}
                  className="h-6 w-6 p-0 shrink-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-[var(--cc-text-muted)] mt-0.5 line-clamp-2">{notification.message}</p>
              {notification.action ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={notification.action.onClick}
                  className="mt-1.5 h-7 px-2 text-xs text-[var(--cc-accent-dark)]"
                >
                  {notification.action.label}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className={cn("w-5 h-5", portalAccentIconClass(aiTutorTheme))} />
          Smart Notifications ({notifications.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotifications(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {notifications
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 }
            return priorityOrder[b.priority] - priorityOrder[a.priority]
          })
          .map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={cn("border-2", getNotificationColor(notification.type))}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissNotification(notification.id)}
                          className="h-6 w-6 p-0 -mt-1"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                        {notification.message}
                      </p>
                      {notification.action && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={notification.action.onClick}
                          className="h-7"
                        >
                          {notification.action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}

