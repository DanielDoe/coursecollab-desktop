"use client"

import { Copy, Library, MoreHorizontal, Pencil, TextSelect } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type CoraUserMessageMenuAction = "copy" | "edit" | "select-text" | "reattach-import"

type Props = {
  hasImportedQuestion?: boolean
  onAction: (action: CoraUserMessageMenuAction) => void
  className?: string
}

export function CoraUserMessageMenu({ hasImportedQuestion = false, onAction, className }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]",
            className,
          )}
          title="Message actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onAction("copy")}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy
        </DropdownMenuItem>
        {!hasImportedQuestion ? (
          <DropdownMenuItem onClick={() => onAction("reattach-import")}>
            <Library className="mr-2 h-3.5 w-3.5" />
            Re-attach from course
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => onAction("edit")}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("select-text")}>
          <TextSelect className="mr-2 h-3.5 w-3.5" />
          Select text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
