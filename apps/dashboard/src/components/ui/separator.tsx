import * as React from 'react'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical'; decorative?: boolean }>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'shrink-0 bg-border',
          orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
          className
        )}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        {...props}
      />
    )
  }
)
Separator.displayName = 'Separator'

export { Separator }