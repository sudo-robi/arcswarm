import * as React from 'react'
import { cn } from '@/lib/utils'

const Progress = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: number }>(
  ({ className, value = 0, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <div
          className="h-full bg-primary flex-1 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }