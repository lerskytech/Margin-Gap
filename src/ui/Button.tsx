import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70 disabled:text-foreground/60 active:scale-[0.98]'
    
    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5 shadow-sm',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-subtle',
      outline: 'border border-border bg-surface hover:bg-accent hover:text-accent-foreground hover:border-primary/50',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
    }
    
    const sizes = {
      sm: 'h-11 sm:h-9 px-4 sm:px-3 text-base sm:text-sm',
      md: 'h-11 sm:h-11 px-4 sm:px-5 text-base sm:text-sm',
      lg: 'h-12 sm:h-12 px-6 sm:px-8 text-base',
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
