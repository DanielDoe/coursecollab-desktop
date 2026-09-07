"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import DOMPurify from "isomorphic-dompurify"
import { isAnnouncementHtml } from "@/lib/announcement-content"
import { cn } from "@/lib/utils"
import "./announcement-editor.css"

type AnnouncementContentProps = {
  content: string
  className?: string
}

export function AnnouncementContent({ content, className }: AnnouncementContentProps) {
  if (!content?.trim()) return null

  if (isAnnouncementHtml(content)) {
    const clean = DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel", "colspan", "rowspan", "style"],
    })

    return (
      <div
        className={cn(
          "announcement-content-render prose prose-slate dark:prose-invert max-w-none",
          "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:break-words",
          "prose-a:text-sky-600 dark:prose-a:text-sky-400 prose-a:no-underline hover:prose-a:underline prose-a:break-all",
          "prose-img:max-w-full prose-img:h-auto",
          "prose-pre:overflow-x-auto prose-pre:max-w-full",
          "prose-table:block prose-table:overflow-x-auto prose-table:max-w-full",
          "prose-table:text-sm",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    )
  }

  return (
    <div
      className={cn(
        "prose prose-slate dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:break-words",
        "prose-a:text-sky-600 dark:prose-a:text-sky-400 prose-a:break-all",
        "prose-img:max-w-full prose-img:h-auto",
        "prose-pre:overflow-x-auto prose-pre:max-w-full",
        "prose-table:block prose-table:overflow-x-auto prose-table:max-w-full",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
