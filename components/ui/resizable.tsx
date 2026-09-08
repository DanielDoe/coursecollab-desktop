'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

type ResizablePanelGroupProps = React.ComponentProps<typeof Group> & {
  /** @deprecated Use `orientation` — kept for shadcn compatibility */
  direction?: 'horizontal' | 'vertical'
}

function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={orientation ?? direction ?? 'horizontal'}
      className={cn(
        'flex h-full w-full data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'bg-border focus-visible:ring-ring relative z-10 shrink-0 touch-none select-none',
        'flex w-px items-center justify-center',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1.5 after:-translate-x-1/2',
        'focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        'data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full',
        'data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-1.5 data-[orientation=vertical]:after:w-full',
        'data-[orientation=vertical]:after:translate-x-0 data-[orientation=vertical]:after:-translate-y-1/2',
        '[&[data-orientation=vertical]>div]:rotate-90',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="bg-border z-10 flex h-5 w-1.5 items-center justify-center rounded-[2px] border opacity-80 shadow-none">
          <GripVerticalIcon className="size-2 opacity-60" />
        </div>
      ) : null}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
