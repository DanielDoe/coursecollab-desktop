import * as React from 'react'

import { cn } from '@/lib/utils'
import { CC_FIELD } from '@/lib/appearance/ui-primitives'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none md:text-sm',
        CC_FIELD.base,
        CC_FIELD.focus,
        CC_FIELD.invalid,
        CC_FIELD.disabled,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
