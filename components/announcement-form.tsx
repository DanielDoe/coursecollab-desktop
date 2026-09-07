"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2, Pin, Upload, X, FileText, Image, Video, Trash2, MessageCircle, Heart, Download, Lock, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { AnnouncementRichTextEditor } from "@/components/announcements/AnnouncementRichTextEditor"
import { isAnnouncementContentEmpty } from "@/lib/announcement-content"
import { isInvalidPersistedAttachmentUrl } from "@/lib/announcement-attachments"

interface AnnouncementFormProps {
  instructorId: string
  courseId?: string
  initialData?: {
    id?: number
    title: string
    content: string
    pinned: boolean
    allow_reactions?: boolean
    allow_comments?: boolean
    student_content_locked?: boolean
    ai_summary?: string | null
    attachments: Array<{ name: string; url: string; type: string; file?: File }>
  }
  onSuccess?: () => void
  onCancel?: () => void
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Video
  return FileText
}

type FormAttachment = {
  name: string
  url: string
  type: string
  file?: File
  uploading?: boolean
  uploadKey?: string
}

function sanitizeAttachmentsForSave(
  attachments: FormAttachment[],
): Array<{ name: string; url: string; type: string }> {
  return attachments
    .filter((att) => !att.uploading && !isInvalidPersistedAttachmentUrl(att.url))
    .map(({ name, url, type }) => ({ name, url, type }))
}

export function AnnouncementForm({ 
  instructorId,
  courseId,
  initialData, 
  onSuccess, 
  onCancel 
}: AnnouncementFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [aiSummaryPreview, setAiSummaryPreview] = useState(initialData?.ai_summary?.trim() ?? "")
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    content: initialData?.content || "",
    pinned: initialData?.pinned || false,
    allow_reactions: initialData?.allow_reactions !== undefined ? initialData.allow_reactions : true,
    allow_comments: initialData?.allow_comments !== undefined ? initialData.allow_comments : true,
    student_content_locked: initialData?.student_content_locked ?? false,
    attachments: (initialData?.attachments || []).filter(
      (att) => !isInvalidPersistedAttachmentUrl(att.url),
    ) as FormAttachment[],
  })

  useEffect(() => {
    if (!initialData?.attachments?.length) return
    const invalid = initialData.attachments.filter((att) =>
      isInvalidPersistedAttachmentUrl(att.url),
    )
    if (invalid.length > 0) {
      toast({
        title: "Attachments need re-upload",
        description: `${invalid.length} file(s) were not stored correctly. Add them again before saving.`,
        variant: "destructive",
      })
    }
  }, [initialData?.id])

  useEffect(() => {
    setAiSummaryPreview(initialData?.ai_summary?.trim() ?? "")
  }, [initialData?.ai_summary, initialData?.id])

  const uploadFileToServer = async (file: File) => {
    if (!courseId) {
      throw new Error("Select a course before uploading files.")
    }
    const fd = new FormData()
    fd.append("file", file)
    const res = await studentApiFetch("/api/announcements/upload", {
      method: "POST",
      headers: {
        "x-instructor-id": instructorId,
        "x-course-id": courseId,
      },
      body: fd,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || `Failed to upload ${file.name}`)
    }
    return {
      name: data.name as string,
      url: data.url as string,
      type: data.type as string,
    }
  }

  const isEditing = !!initialData?.id

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || isAnnouncementContentEmpty(formData.content)) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive"
      })
      return
    }

    if (formData.attachments.some((att) => att.uploading)) {
      toast({
        title: "Upload in progress",
        description: "Wait for all files to finish uploading before saving.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const uploadAttachment = async (att: FormAttachment) => {
        if (att.file && isInvalidPersistedAttachmentUrl(att.url)) {
          return uploadFileToServer(att.file)
        }
        if (isInvalidPersistedAttachmentUrl(att.url)) {
          throw new Error(
            `Attachment "${att.name}" must be uploaded to the server. Remove it and add the file again.`,
          )
        }
        return { name: att.name, url: att.url, type: att.type }
      }

      const persistedAttachments = sanitizeAttachmentsForSave(
        await Promise.all(formData.attachments.map(uploadAttachment)),
      )

      const url = isEditing 
        ? `/api/announcements/${initialData.id}`
        : '/api/announcements'
      
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-instructor-id': instructorId,
          ...(courseId ? { 'x-course-id': courseId } : {}),
        },
        body: JSON.stringify({
          ...formData,
          attachments: persistedAttachments,
          ...(courseId ? { course_id: Number(courseId) } : {}),
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save announcement')
      }

      const savedSummary =
        typeof data.announcement?.ai_summary === "string" ? data.announcement.ai_summary.trim() : ""
      if (savedSummary) setAiSummaryPreview(savedSummary)

      toast({
        title: isEditing ? "Announcement Updated" : "Announcement Created",
        description: isEditing
          ? savedSummary
            ? "Saved — the AI mobile summary was refreshed for students."
            : "Your announcement has been updated successfully"
          : savedSummary
            ? "Published — students will see the AI summary on mobile and dashboard cards."
            : "Your announcement has been created and is now visible to students",
      })

      onSuccess?.()
    } catch (error) {
      console.error('Error saving announcement:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save announcement",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    if (!courseId) {
      toast({
        title: "Course required",
        description: "Select a course before uploading files.",
        variant: "destructive",
      })
      e.target.value = ""
      return
    }

    let uploadedCount = 0

    for (const file of Array.from(files)) {
      const uploadKey = `${file.name}-${file.size}-${Date.now()}`

      setFormData((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          {
            name: file.name,
            url: "",
            type: file.type || "application/octet-stream",
            file,
            uploading: true,
            uploadKey,
          },
        ],
      }))

      try {
        const uploaded = await uploadFileToServer(file)
        uploadedCount += 1
        setFormData((prev) => ({
          ...prev,
          attachments: prev.attachments.map((att) =>
            att.uploadKey === uploadKey ? { ...uploaded } : att,
          ),
        }))
      } catch (error) {
        setFormData((prev) => ({
          ...prev,
          attachments: prev.attachments.filter((att) => att.uploadKey !== uploadKey),
        }))
        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : `Failed to upload ${file.name}`,
          variant: "destructive",
        })
      }
    }

    if (uploadedCount > 0) {
      toast({
        title: "Files uploaded",
        description: `${uploadedCount} file(s) saved to the server and ready to attach`,
      })
    }

    e.target.value = ""
  }

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                {isEditing ? "Edit Announcement" : "Create New Announcement"}
              </CardTitle>
              <CardDescription className="text-base">
                {isEditing 
                  ? "Update the announcement details below"
                  : "Create a new announcement to share with all students"
                }
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Title Input */}
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Label htmlFor="title" className="text-base font-semibold">Title *</Label>
              <Input
                id="title"
                placeholder="Enter announcement title..."
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={loading}
                required
                className="h-12 text-base border-2 border-slate-200 focus:border-rose-400 transition-colors duration-200"
              />
            </motion.div>

            {/* Rich content editor */}
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Label className="text-base font-semibold">Content *</Label>
              <AnnouncementRichTextEditor
                value={formData.content}
                onChange={(html) => setFormData((prev) => ({ ...prev, content: html }))}
                disabled={loading}
                placeholder="Write your announcement… Use headings, bold, lists, tables, links, and alignment from the toolbar."
              />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Formatting is saved automatically. Students see the same rich layout you compose here.
              </p>
            </motion.div>

            {/* Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Settings</h3>
              
              {/* Pin Toggle */}
              <motion.div 
                className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Pin className="size-5 text-amber-500" />
                    <Label htmlFor="pinned" className="text-base font-semibold">Pin Announcement</Label>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Pinned announcements appear at the top of the student feed
                  </p>
                </div>
                <Switch
                  id="pinned"
                  checked={formData.pinned}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pinned: checked }))}
                  disabled={loading}
                  className="data-[state=checked]:bg-amber-500"
                />
              </motion.div>

              {/* Allow Reactions Toggle */}
              <motion.div 
                className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Heart className="size-5 text-rose-500" />
                    <Label htmlFor="allow_reactions" className="text-base font-semibold">Allow Reactions</Label>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Students can react with emojis (like, love, etc.)
                  </p>
                </div>
                <Switch
                  id="allow_reactions"
                  checked={formData.allow_reactions}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_reactions: checked }))}
                  disabled={loading}
                  className="data-[state=checked]:bg-rose-500"
                />
              </motion.div>

              {/* Allow Comments Toggle */}
              <motion.div 
                className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="size-5 text-blue-500" />
                    <Label htmlFor="allow_comments" className="text-base font-semibold">Allow Comments</Label>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Students can comment and discuss on this announcement
                  </p>
                </div>
                <Switch
                  id="allow_comments"
                  checked={formData.allow_comments}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_comments: checked }))}
                  disabled={loading}
                  className="data-[state=checked]:bg-blue-500"
                />
              </motion.div>

              {/* Lock Content for Students */}
              <motion.div 
                className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-700"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52 }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Lock className="size-5 text-amber-600" />
                    <Label htmlFor="student_content_locked" className="text-base font-semibold">Lock content for students</Label>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Students see the title only. Body and attachments stay hidden until you unlock it in class.
                  </p>
                </div>
                <Switch
                  id="student_content_locked"
                  checked={formData.student_content_locked}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, student_content_locked: checked }))}
                  disabled={loading}
                  className="data-[state=checked]:bg-amber-600"
                />
              </motion.div>

              {/* AI mobile summary (auto-generated on save) */}
              <motion.div
                className="rounded-xl border-2 border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-slate-50 p-6 dark:border-violet-500/25 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-950"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.54 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                    <Sparkles className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        AI summary for students
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        When you publish or update, CourseCollab generates a short summary from the title and body.
                        It appears on the{" "}
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">mobile app feed</strong>{" "}
                        and dashboard cards so students can scan updates without reading the full post. The summary
                        refreshes automatically whenever the title or content changes.
                      </p>
                    </div>
                    {formData.student_content_locked ? (
                      <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                        Locked announcements still get an AI summary, but students only see a placeholder until you
                        unlock content in class.
                      </p>
                    ) : null}
                    {aiSummaryPreview ? (
                      <div className="rounded-lg border border-violet-200/70 bg-white/80 px-4 py-3 dark:border-violet-500/20 dark:bg-slate-950/40">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          Current AI summary
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                          {aiSummaryPreview}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm italic text-slate-500 dark:text-slate-400">
                        Save this announcement to generate the first AI summary preview.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* File Attachments */}
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Label className="text-base font-semibold">Attachments (Optional)</Label>
              
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={loading}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-200"
                >
                  <Upload className="mr-2 size-5" />
                  Upload Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={loading}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Supports PDF, DOC, images, and videos
                </p>
              </div>

              {/* Display attached files */}
              {formData.attachments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <FileText className="w-4 h-4" />
                    <span>Attached Files ({formData.attachments.length})</span>
                  </div>
                  
                  <div className="grid gap-3">
                    {formData.attachments.map((attachment, index) => {
                      const Icon = getFileIcon(attachment.type)
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-md bg-white dark:bg-slate-700 shadow-sm shrink-0">
                              <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                {attachment.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">
                                {attachment.uploading ? "Uploading to server…" : attachment.type}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {attachment.uploading && (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                            )}
                            {!attachment.uploading &&
                              attachment.url &&
                              !isInvalidPersistedAttachmentUrl(attachment.url) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={loading}
                                onClick={async () => {
                                  try {
                                    const { downloadAnnouncementAttachment } = await import("@/lib/announcement-attachments")
                                    await downloadAnnouncementAttachment(attachment)
                                  } catch (error) {
                                    toast({
                                      title: "Download failed",
                                      description: error instanceof Error ? error.message : "Could not download file",
                                      variant: "destructive",
                                    })
                                  }
                                }}
                                className="text-slate-600 hover:text-slate-900 dark:text-slate-400"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            {isInvalidPersistedAttachmentUrl(attachment.url) && !attachment.uploading && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 px-2">Re-upload</span>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttachment(index)}
                              disabled={loading}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </CardContent>

          <CardFooter className="flex justify-end gap-3 pt-6">
            {onCancel && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onCancel}
                  disabled={loading}
                  className="border-2 border-slate-200 hover:border-slate-300 transition-colors duration-200"
                >
                  Cancel
                </Button>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button 
                type="submit" 
                disabled={loading}
                size="lg"
                className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-lg shadow-rose-500/25 transition-all duration-200"
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Update" : "Create"} Announcement
              </Button>
            </motion.div>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}

