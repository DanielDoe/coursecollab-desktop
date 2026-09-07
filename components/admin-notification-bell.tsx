"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAdminNotifications } from "@/lib/admin-notification-context"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PORTAL_NOTIFICATION_BADGE } from "@/lib/appearance/portal-nav-classes"

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
  password_reset_request: "🔑",
  default: "📢",
}

export function AdminNotificationBell({ variant = "default" }: { variant?: "default" | "app-bar" }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useAdminNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // --- Handle click outside ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleMarkAllAsRead = () => markAllAsRead()
  const handleNotificationClick = (id: number) => {
    markAsRead(id)
    setIsOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={cn(
          "relative overflow-visible transition-all duration-300",
          variant === "app-bar"
            ? cn(
                "size-9 rounded-xl text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
                isOpen && "ring-2 ring-[var(--border)]",
              )
            : cn(
                "rounded-xl sm:rounded-2xl size-9 sm:size-10 md:size-11 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] md:min-w-[44px] md:min-h-[44px]",
                "text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]",
                "hover:bg-[var(--sidebar-accent)]",
                isOpen && "bg-[var(--sidebar-accent)] text-[var(--cc-text)] ring-2 ring-[var(--cc-accent-border)]",
              ),
        )}
        style={{
          boxShadow: "none",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 pointer-events-none" strokeWidth={2.25} />
        ) : (
          <Bell className="h-5 w-5 pointer-events-none" strokeWidth={2} />
        )}
        {unreadCount > 0 && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-0.5 -right-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5",
              unreadCount > 9 && "min-w-[17px] px-1",
              PORTAL_NOTIFICATION_BADGE,
              "text-[9px] font-bold tabular-nums leading-none",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {/* 🩵 Admin Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 max-h-[500px] overflow-hidden rounded-2xl shadow-2xl border border-gray-200/50 dark:border-neutral-700/50 backdrop-blur-xl bg-white/70 dark:bg-neutral-900/80 animate-fadeSlideIn z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200/50 dark:border-neutral-700/50">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Admin Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-5 text-center text-muted-foreground text-sm">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/50 dark:divide-neutral-700/50">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || "#"}
                    onClick={() => handleNotificationClick(n.id)}
                    className={cn(
                      "block p-4 transition-all hover:bg-gray-100/70 dark:hover:bg-neutral-800/60",
                      "hover:translate-x-1",
                      !n.is_read && "bg-blue-50/60 dark:bg-blue-900/30",
                    )}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="text-2xl flex-shrink-0">
                        {notificationIcons[n.type] || notificationIcons.default}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-medium text-[0.95rem] leading-tight text-gray-900 dark:text-gray-100">
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200/50 dark:border-neutral-700/50 p-3 bg-gradient-to-t from-gray-50/80 dark:from-neutral-900/70">
              <Link href="/admin/notifications" onClick={() => setIsOpen(false)}>
                <button className="w-full text-sm py-2.5 rounded-xl font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition">
                  View all notifications
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ✨ Animations + Scrollbar Style */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 0.25s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(100, 100, 100, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(100, 100, 100, 0.5);
        }
      `}</style>
    </div>
  )
}
