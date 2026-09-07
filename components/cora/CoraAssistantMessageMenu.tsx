"use client"

import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CORA_MESSAGE_MENU_ITEMS,
  type CoraMessageMenuActionId,
} from "@/lib/cora/message-actions"
import { cn } from "@/lib/utils"

type Props = {
  isLastAssistant: boolean
  onAction: (action: CoraMessageMenuActionId) => void
  className?: string
}

export function CoraAssistantMessageMenu({ isLastAssistant, onAction, className }: Props) {
  const items = CORA_MESSAGE_MENU_ITEMS.filter((item) => {
    if (item.lastResponseOnly && !isLastAssistant) return false
    return true
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]",
            className,
          )}
          title="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {items.map((item, index) => (
          <div key={item.id}>
            {item.destructive && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              className={item.destructive ? "text-red-600 focus:text-red-600" : undefined}
              onClick={() => onAction(item.id)}
            >
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
