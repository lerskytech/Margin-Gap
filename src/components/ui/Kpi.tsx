import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface KpiProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Kpi = forwardRef<HTMLDivElement, KpiProps>(
  ({ className, label, value, delta, deltaLabel, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    }

    const valueSizeClasses = {
      sm: 'text-lg',
      md: 'text-2xl',
      lg: 'text-3xl',
    }

    return (
      <div
        ref={ref}
        className={cn('space-y-1', className)}
        {...props}
      >
        <div className={cn('text-xs font-medium uppercase tracking-wide text-muted-foreground', sizeClasses[size])}>
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <div className={cn('font-semibold tabular-nums', valueSizeClasses[size])}>
            {value}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded',
                delta >= 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}
            >
              {delta >= 0 ? '+' : ''}{delta}% {deltaLabel}
            </div>
          )}
        </div>
      </div>
    )
  }
)

Kpi.displayName = 'Kpi'

