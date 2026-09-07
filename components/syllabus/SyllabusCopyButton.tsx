"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SyllabusCopyButtonProps = {
  value: string
  label?: string
  className?: string
}

export function SyllabusCopyButton({ value, label = "Copied", className }: SyllabusCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(label)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground", className)}
      onClick={() => void copy()}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[var(--cc-accent-dark)]" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
