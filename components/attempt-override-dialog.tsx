"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface AttemptOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quizId: string
  studentId: string
  studentName: string
  studentCode: string
  currentAttempts: number
  maxAttempts: number
  onSuccess?: () => void
}

export function AttemptOverrideDialog({
  open,
  onOpenChange,
  quizId,
  studentId,
  studentName,
  studentCode,
  currentAttempts,
  maxAttempts,
  onSuccess,
}: AttemptOverrideDialogProps) {
  const { toast } = useToast()
  const [additionalAttempts, setAdditionalAttempts] = useState(1)
  const [reason, setReason] = useState("")
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (additionalAttempts < 1) {
      toast({
        title: "Invalid Input",
        description: "Additional attempts must be at least 1",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const instructorId = localStorage.getItem("instructorId")
      const response = await instructorApiFetch("/api/instructor/attempt-overrides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-id": instructorId || "",
        },
        body: JSON.stringify({
          quizId: parseInt(quizId),
          studentId: parseInt(studentId),
          additionalAttempts,
          reason: reason || undefined,
          expiresAt: expiresAt?.toISOString(),
          instructorId: instructorId ? parseInt(instructorId) : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to grant override")
      }

      toast({
        title: "Override Granted",
        description: `Granted ${additionalAttempts} extra attempt(s) to ${studentName}`,
      })

      setAdditionalAttempts(1)
      setReason("")
      setExpiresAt(undefined)
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to grant override",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Grant Extra Attempts</DialogTitle>
          <DialogDescription>
            Grant additional quiz attempts to {studentName} ({studentCode}) beyond their membership limit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Student Information</Label>
            <div className="text-sm text-muted-foreground">
              <p><strong>Name:</strong> {studentName}</p>
              <p><strong>Student ID:</strong> {studentCode}</p>
              <p><strong>Current Attempts:</strong> {currentAttempts} / {maxAttempts}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalAttempts">Additional Attempts</Label>
            <Input
              id="additionalAttempts"
              type="number"
              min="1"
              max="10"
              value={additionalAttempts}
              onChange={(e) => setAdditionalAttempts(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground">
              Number of extra attempts to grant (beyond membership limit of {maxAttempts})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Technical difficulties, internet issues, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiration. Override will be active until revoked.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Granting..." : "Grant Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

