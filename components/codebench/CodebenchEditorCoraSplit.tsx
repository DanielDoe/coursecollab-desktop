"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronsLeft } from "lucide-react"
import { usePanelRef } from "react-resizable-panels"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { CodebenchCoraPanelProvider } from "@/components/codebench/codebench-cora-panel-context"
import { cn } from "@/lib/utils"

const EMBED_SPLIT_STORAGE_KEYS = [
  "react-resizable-panels:codebench-embed-split",
  "react-resizable-panels:codebench-embed-split-v2",
] as const

const PANEL_EDITOR = "editor"
const PANEL_CORA = "cora"
const CORA_RAIL_PX = "28px"
const CORA_EXPANDED_MIN_PX = 96

export type CodebenchCoraPanelControl = {
  collapsed: boolean
  toggleCollapse: () => void
  expand: () => void
}

type SplitProps = {
  editor: ReactNode
  cora: ReactNode
  className?: string
  onPanelResize?: () => void
  onCoraPanelControl?: (control: CodebenchCoraPanelControl) => void
}

function clearInvalidEmbedSplitStorage() {
  if (typeof window === "undefined") return
  for (const key of EMBED_SPLIT_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      JSON.parse(raw)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

function CodebenchEmbeddedSplit({ editor, cora, className, onPanelResize, onCoraPanelControl }: SplitProps) {
  const frameRef = useRef<number | null>(null)
  const resizeSyncLockRef = useRef(false)
  const coraPanelRef = usePanelRef()
  const [coraCollapsed, setCoraCollapsed] = useState(false)

  useEffect(() => {
    clearInvalidEmbedSplitStorage()
  }, [])

  const notifyPanelResize = useCallback(() => {
    if (frameRef.current != null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      onPanelResize?.()
    })
  }, [onPanelResize])

  const applyCoraPanelLayout = useCallback(
    (collapsed: boolean) => {
      const panel = coraPanelRef.current
      if (!panel) return false

      resizeSyncLockRef.current = true
      if (collapsed) {
        panel.collapse()
      } else {
        panel.expand()
      }
      notifyPanelResize()
      window.setTimeout(() => {
        resizeSyncLockRef.current = false
      }, 350)
      return true
    },
    [coraPanelRef, notifyPanelResize],
  )

  const toggleCoraCollapse = useCallback(() => {
    setCoraCollapsed((collapsed) => {
      const next = !collapsed
      if (!applyCoraPanelLayout(next)) {
        requestAnimationFrame(() => {
          applyCoraPanelLayout(next)
        })
      }
      return next
    })
  }, [applyCoraPanelLayout])

  const expandCoraPanel = useCallback(() => {
    setCoraCollapsed((collapsed) => {
      if (!collapsed) return collapsed
      if (!applyCoraPanelLayout(false)) {
        requestAnimationFrame(() => {
          applyCoraPanelLayout(false)
        })
      }
      return false
    })
  }, [applyCoraPanelLayout])

  useEffect(() => {
    onCoraPanelControl?.({
      collapsed: coraCollapsed,
      toggleCollapse: toggleCoraCollapse,
      expand: expandCoraPanel,
    })
  }, [coraCollapsed, expandCoraPanel, onCoraPanelControl, toggleCoraCollapse])

  const handleCoraPanelResize = useCallback(
    (panelSize: { inPixels: number }) => {
      if (resizeSyncLockRef.current) {
        notifyPanelResize()
        return
      }

      const panel = coraPanelRef.current
      if (!panel) {
        notifyPanelResize()
        return
      }

      if (panel.isCollapsed()) {
        setCoraCollapsed(true)
      } else if (coraCollapsed && panelSize.inPixels > CORA_EXPANDED_MIN_PX) {
        setCoraCollapsed(false)
      }

      notifyPanelResize()
    },
    [coraCollapsed, coraPanelRef, notifyPanelResize],
  )

  const coraRailExpandClass = cn(
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-l-md border border-r-0",
    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-muted)] shadow-sm",
    "hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
  )

  return (
    <CodebenchCoraPanelProvider value={{ collapsed: coraCollapsed, toggleCollapse: toggleCoraCollapse }}>
      <div className={cn("h-full min-h-0 w-full flex-1", className)}>
        <ResizablePanelGroup
          orientation="horizontal"
          resizeTargetMinimumSize={{ coarse: 24, fine: 8 }}
          className="h-full min-h-0 w-full"
        >
          <ResizablePanel
            id={PANEL_EDITOR}
            defaultSize="48"
            minSize="25"
            maxSize="100"
            className="min-h-0 min-w-0"
            onResize={notifyPanelResize}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{editor}</div>
          </ResizablePanel>
          <ResizableHandle className="bg-[var(--border)] hover:bg-[var(--cc-accent)]/25 data-[separator=active]:bg-[var(--cc-accent)]/35" />
          <ResizablePanel
            id={PANEL_CORA}
            panelRef={coraPanelRef}
            collapsible
            collapsedSize={CORA_RAIL_PX}
            defaultSize="52"
            minSize="22"
            maxSize="75"
            className="min-h-0 min-w-0"
            onResize={handleCoraPanelResize}
          >
            {coraCollapsed ? (
              <div className="flex h-full min-h-0 w-full flex-col border-l border-[var(--border)] bg-[var(--card)]">
                <div className="flex h-9 w-full shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--card)]">
                  <button
                    type="button"
                    onClick={toggleCoraCollapse}
                    className={coraRailExpandClass}
                    aria-label="Expand Cora panel"
                    title="Expand Cora panel"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--card)]">
                {cora}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </CodebenchCoraPanelProvider>
  )
}

type Props = SplitProps & {
  embedded?: boolean
}

export function CodebenchEditorCoraSplit({
  embedded,
  editor,
  cora,
  className,
  onPanelResize,
  onCoraPanelControl,
}: Props) {
  if (embedded) {
    return (
      <CodebenchEmbeddedSplit
        editor={editor}
        cora={cora}
        className={className}
        onPanelResize={onPanelResize}
        onCoraPanelControl={onCoraPanelControl}
      />
    )
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 w-full flex-1 flex-col lg:flex-row", className)}>
      <div className="flex min-h-[200px] min-w-0 flex-1 flex-col border-b border-[var(--border)] lg:min-h-0 lg:w-1/2 lg:border-b-0 lg:border-r xl:w-[48%]">
        {editor}
      </div>
      <div className="flex min-h-[200px] min-w-0 flex-1 flex-col overflow-hidden bg-[var(--card)] lg:min-h-0 lg:w-1/2 xl:w-[52%]">
        {cora}
      </div>
    </div>
  )
}
