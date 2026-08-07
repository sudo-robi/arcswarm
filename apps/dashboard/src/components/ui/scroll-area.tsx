import * as React from 'react'
import { cn } from '@/lib/utils'

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex h-full overflow-auto', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }