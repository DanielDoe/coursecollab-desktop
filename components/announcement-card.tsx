"use client"

import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Pin, ThumbsUp, Heart, Laugh, Flame, Sparkles, MoreVertical, Download, FileText, Image, Video } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
}

interface AnnouncementCardProps {
  announcement: Announcement
  variant?: "student" | "instructor"
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onPin?: () => void
}

const reactionIcons = {
  like: ThumbsUp,
  love: Heart,
  laugh: Laugh,
  fire: Flame,
  wow: Sparkles,
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Video
  return FileText
}

export function AnnouncementCard({ 
  announcement, 
  variant = "student",
  onView,
  onEdit,
  onDelete,
  onPin
}: AnnouncementCardProps) {
  const truncateContent = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content
    return content.slice(0, maxLength) + "..."
  }

  const getAttachmentIcon = (attachment: { name: string; url: string; type: string }) => {
    const Icon = getFileIcon(attachment.type)
    return <Icon className="w-4 h-4" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
        announcement.pinned 
          ? 'border-2 border-sky-400/60 dark:border-sky-500/50 bg-sky-50/50 dark:bg-sky-950/20' 
          : 'border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
      }`}>
        {/* Pinned Badge */}
        {announcement.pinned && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge className="bg-sky-600 dark:bg-sky-600 text-white shadow-lg border-0">
                <Pin className="mr-1 size-3" />
                Pinned
              </Badge>
            </motion.div>
          </div>
        )}

        {/* Gradient overlay for pinned announcements */}
        {announcement.pinned && (
          <div className="absolute inset-0 bg-sky-500/5 pointer-events-none" />
        )}

        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
                  {announcement.title}
                </CardTitle>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <CardDescription className="flex items-center gap-2 mt-2 text-sm">
                  {announcement.author_name && (
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      By {announcement.author_name}
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-500">•</span>
                  <span className="text-slate-500 dark:text-slate-500">
                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                  </span>
                  {announcement.updated_at !== announcement.created_at && (
                    <>
                      <span className="text-slate-500 dark:text-slate-500">•</span>
                      <Badge variant="outline" className="text-xs">
                        Edited
                      </Badge>
                    </>
                  )}
                </CardDescription>
              </motion.div>
            </div>

            {variant === "instructor" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-200"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onPin} className="cursor-pointer">
                      <span>{announcement.pinned ? "Unpin" : "Pin"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={onDelete}
                      className="text-destructive cursor-pointer focus:text-destructive"
                    >
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap"
          >
            {truncateContent(announcement.content)}
          </motion.div>

          {/* Attachments */}
          {announcement.attachments && announcement.attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                <FileText className="w-4 h-4" />
                <span>Attachments ({announcement.attachments.length})</span>
              </div>
              <div className="grid gap-2">
                {announcement.attachments.map((attachment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-200 group/attachment"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-white dark:bg-slate-700 shadow-sm">
                        {getAttachmentIcon(attachment)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {attachment.type}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover/attachment:opacity-100 transition-opacity duration-200"
                      onClick={() => window.open(attachment.url, '_blank')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400"
          >
            {/* Views Counter */}
            <div className="flex items-center gap-2">
              <Eye className="size-4" />
              <span className="font-medium">{announcement.views_count}</span>
              <span className="text-xs">views</span>
            </div>

            {/* Reactions Display */}
            {announcement.reactions_breakdown && 
             Object.keys(announcement.reactions_breakdown).length > 0 && (
              <div className="flex items-center gap-3">
                {Object.entries(announcement.reactions_breakdown).map(([type, count]) => {
                  const Icon = reactionIcons[type as keyof typeof reactionIcons]
                  return Icon ? (
                    <motion.div 
                      key={type} 
                      className="flex items-center gap-1"
                      whileHover={{ scale: 1.1 }}
                    >
                      <Icon className="size-4" />
                      <span className="font-medium">{count}</span>
                    </motion.div>
                  ) : null
                })}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onView}
              className="group-hover:bg-rose-50 group-hover:border-rose-200 group-hover:text-rose-600 dark:group-hover:bg-rose-950/20 dark:group-hover:border-rose-800 dark:group-hover:text-rose-400 transition-all duration-200"
            >
              View Details
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}