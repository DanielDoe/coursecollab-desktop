"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, Eye, AlertTriangle } from "lucide-react"
import {
  downloadAnnouncementAttachment,
  isInvalidPersistedAttachmentUrl,
  isPdfAttachment,
  type AnnouncementAttachment,
} from "@/lib/announcement-attachments"
import { useToast } from "@/hooks/use-toast"

type AnnouncementAttachmentActionsProps = {
  attachment: AnnouncementAttachment
  compact?: boolean
  locked?: boolean
}

export function AnnouncementAttachmentActions({
  attachment,
  compact = false,
  locked = false,
}: AnnouncementAttachmentActionsProps) {
  const { toast } = useToast()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const invalid = isInvalidPersistedAttachmentUrl(attachment.url)
  const isPdf = isPdfAttachment(attachment)

  const handleError = (error: unknown) => {
    toast({
      title: "Attachment unavailable",
      description:
        error instanceof Error
          ? error.message
          : "This file could not be opened. Try re-uploading it from the edit screen.",
      variant: "destructive",
    })
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      await downloadAnnouncementAttachment(attachment)
    } catch (error) {
      handleError(error)
    } finally {
      setDownloading(false)
    }
  }

  const handlePreview = async () => {
    if (invalid) {
      handleError(new Error(`"${attachment.name}" was not saved to the server. Edit the announcement and upload the file again.`))
      return
    }

    if (isPdf) {
      setPreviewOpen(true)
      return
    }

    try {
      await downloadAnnouncementAttachment(attachment)
    } catch (error) {
      handleError(error)
    }
  }

  if (invalid) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Re-upload required</span>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Locked</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {isPdf && (
          <Button
            variant="outline"
            size="sm"
            className={compact ? "h-8 px-2" : "gap-1.5"}
            onClick={handlePreview}
          >
            <Eye className="h-4 w-4" />
            {!compact && <span className="hidden sm:inline text-xs">Preview</span>}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={compact ? "h-8 px-2" : "gap-1.5"}
          disabled={downloading}
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline text-xs">Download</span>}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="!max-w-[calc(100vw-1rem)] w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] sm:!max-w-[95vw] sm:w-[95vw] sm:h-[92vh] sm:max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-base sm:text-lg truncate pr-8">
              {attachment.name}
            </DialogTitle>
          </DialogHeader>
          <iframe
            src={attachment.url}
            title={attachment.name}
            className="flex-1 w-full min-h-0 border-0 bg-white"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
