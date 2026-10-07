"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { codebenchLiveClientLabel } from "@/lib/codebench-live-client"
import type { LiveEditorHoldNotice } from "@/hooks/use-student-live-classroom-sessions"

type Props = {
  hold: LiveEditorHoldNotice | null
  open: boolean
  onMoveHere: () => void
  onKeepThere: () => void
}

/** Asks before a live classroom moves, the way a call offers to continue on another device. */
export function LiveClassroomHandoffDialog({ hold, open, onMoveHere, onKeepThere }: Props) {
  const here = codebenchLiveClientLabel()
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue live classroom here?</AlertDialogTitle>
          <AlertDialogDescription>
            {hold
              ? `You're in “${hold.title}” on your ${hold.clientLabel}. Move it to this ${here}? The other device will leave the session, and the code you already wrote comes with it.`
              : "This live classroom is open on another device."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepThere}>Keep it there</AlertDialogCancel>
          <AlertDialogAction onClick={onMoveHere}>Move here</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
