import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--cc-sem-primary)] text-white [a&]:hover:bg-[var(--cc-sem-primary-hover)]',
        secondary:
          'border-transparent bg-[var(--muted)] text-[var(--cc-text)] [a&]:hover:bg-[var(--border)]',
        destructive:
          'border-transparent bg-[var(--cc-sem-danger)] text-white [a&]:hover:bg-[var(--cc-sem-danger-hover)]',
        outline:
          'border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] [a&]:hover:bg-[var(--muted)]',
        success:
          'border-transparent bg-[var(--cc-sem-success-soft)] text-[var(--cc-sem-success-text)] border-[var(--cc-sem-success-border)]',
        warning:
          'border-transparent bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)] border-[var(--cc-sem-warning-border)]',
        info:
          'border-transparent bg-[var(--cc-sem-info-soft)] text-[var(--cc-sem-info-text)] border-[var(--cc-sem-info-border)]',
        premium:
          'border-transparent bg-[var(--cc-sem-reward-soft)] text-[var(--cc-sem-reward-text)] border-[var(--cc-sem-reward-border)]',
        ai:
          'border-transparent bg-[var(--cc-sem-ai-soft)] text-[var(--cc-sem-ai-text)] border-[var(--cc-sem-ai-border)]',
        homework:
          'border-transparent bg-[var(--cc-sem-homework-soft)] text-[var(--cc-sem-homework-text)] border-[var(--cc-sem-homework-border)]',
        attendance:
          'border-transparent bg-[var(--cc-sem-attendance-soft)] text-[var(--cc-sem-attendance-text)] border-[var(--cc-sem-attendance-border)]',
        analytics:
          'border-transparent bg-[var(--cc-sem-analytics-soft)] text-[var(--cc-sem-analytics-text)] border-[var(--cc-sem-analytics-border)]',
        discussion:
          'border-transparent bg-[var(--cc-sem-discussion-soft)] text-[var(--cc-sem-discussion-text)] border-[var(--cc-sem-discussion-border)]',
        neutral:
          'border-transparent bg-[var(--cc-sem-neutral-soft)] text-[var(--cc-sem-neutral-text)] border-[var(--cc-sem-neutral-border)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
