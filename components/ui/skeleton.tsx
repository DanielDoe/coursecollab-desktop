import { cn } from '@/lib/utils'
import { CC_SKELETON } from '@/lib/appearance/ui-primitives'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(CC_SKELETON, className)}
      {...props}
    />
  )
}

export { Skeleton }
