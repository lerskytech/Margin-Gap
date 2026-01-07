import { HTMLAttributes, forwardRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: ReactNode
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, subtitle, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between gap-4', className)}
        {...props}
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    )
  }
)

SectionHeader.displayName = 'SectionHeader'

