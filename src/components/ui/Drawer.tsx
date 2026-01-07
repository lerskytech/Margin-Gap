import { useEffect, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  side?: 'left' | 'right'
}

export function Drawer({ open, onClose, title, children, side = 'left' }: DrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Focus close button on open
      setTimeout(() => closeButtonRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close on ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 w-[85vw] max-w-sm bg-surface border-r border-subtle shadow-premium-lg',
          'transform transition-transform duration-300 ease-out',
          side === 'left' ? 'left-0' : 'right-0',
          open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-subtle">
          {title ? (
            <h2 id="drawer-title" className="text-lg font-semibold">
              {title}
            </h2>
          ) : (
            <div className="flex-1" />
          )}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="ml-auto p-2 rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close drawer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  )
}

