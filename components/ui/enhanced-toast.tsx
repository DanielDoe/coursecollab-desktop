"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle, AlertCircle, Info, Trash2, RotateCcw, Copy, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"

interface EnhancedToastProps {
  id: string
  title: string
  description?: string
  type?: "success" | "error" | "warning" | "info" | "delete" | "restore" | "clone" | "template"
  action?: React.ReactNode
  duration?: number
  onDismiss?: () => void
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
  delete: Trash2,
  restore: RotateCcw,
  clone: Copy,
  template: Bookmark,
}

const toastColors = {
  success: "bg-green-50 border-green-200 text-green-900",
  error: "bg-red-50 border-red-200 text-red-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  delete: "bg-orange-50 border-orange-200 text-orange-900",
  restore: "bg-emerald-50 border-emerald-200 text-emerald-900",
  clone: "bg-purple-50 border-purple-200 text-purple-900",
  template: "bg-indigo-50 border-indigo-200 text-indigo-900",
}

const iconColors = {
  success: "text-green-600",
  error: "text-red-600",
  warning: "text-yellow-600",
  info: "text-blue-600",
  delete: "text-orange-600",
  restore: "text-emerald-600",
  clone: "text-purple-600",
  template: "text-indigo-600",
}

export function EnhancedToast({
  id,
  title,
  description,
  type = "info",
  action,
  duration = 5000,
  onDismiss,
}: EnhancedToastProps) {
  const [isVisible, setIsVisible] = React.useState(true)
  const Icon = toastIcons[type]

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onDismiss?.(), 300) // Wait for animation to complete
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss?.(), 300)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            duration: 0.3 
          }}
          className={cn(
            "fixed top-4 right-4 z-[100] max-w-sm w-full",
            "bg-white rounded-xl border shadow-lg backdrop-blur-sm",
            toastColors[type],
            "transform transition-all duration-300 ease-out"
          )}
          style={{ zIndex: 1000 + parseInt(id) }}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                className={cn("flex-shrink-0 w-6 h-6", iconColors[type])}
              >
                <Icon className="w-6 h-6" />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <motion.h4
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm font-semibold leading-tight"
                >
                  {title}
                </motion.h4>
                
                {description && (
                  <motion.p
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1 text-sm opacity-90 leading-relaxed"
                  >
                    {description}
                  </motion.p>
                )}
                
                {action && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-3"
                  >
                    {action}
                  </motion.div>
                )}
              </div>
              
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
          
          {/* Progress bar */}
          {duration > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-current opacity-30 rounded-b-xl"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: duration / 1000, ease: "linear" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook for using enhanced toasts
export function useEnhancedToast() {
  const [toasts, setToasts] = React.useState<EnhancedToastProps[]>([])

  const addToast = React.useCallback((toast: Omit<EnhancedToastProps, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])
    return id
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return {
    toasts,
    addToast,
    removeToast,
    dismiss,
  }
}

// Toast container component
export function EnhancedToaster() {
  const { toasts, removeToast } = useEnhancedToast()

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <EnhancedToast
          key={toast.id}
          {...toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
