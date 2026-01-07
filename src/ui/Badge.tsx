import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'secondary'
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-secondary text-secondary-foreground border border-subtle',
      success: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      warning: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
      danger: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      secondary: 'bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all hover:scale-105',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
