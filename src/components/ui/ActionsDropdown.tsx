import { useState, useEffect, useRef } from 'react'
import { Button } from '@/ui/Button'

interface ActionsDropdownProps {
  isBaseline: boolean
  isAuthenticated: boolean
  onSetAlert: () => void
  onExportData: () => void
  onShareReport: () => void
}

export function ActionsDropdown({
  isBaseline,
  isAuthenticated,
  onSetAlert,
  onExportData,
  onShareReport,
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSetAlert = () => {
    setIsOpen(false)
    onSetAlert()
  }

  const handleExportData = () => {
    setIsOpen(false)
    onExportData()
  }

  const handleShareReport = () => {
    setIsOpen(false)
    onShareReport()
  }

  // Match original button disabled states
  const setAlertDisabled = isBaseline
  const exportDisabled = isBaseline || !isAuthenticated
  const shareDisabled = isBaseline || !isAuthenticated

  const getHelperText = (requiresAuth: boolean) => {
    if (isBaseline) return 'Run a scan to activate'
    if (requiresAuth && !isAuthenticated) return 'Sign in to activate'
    return undefined
  }

  const setAlertHelperText = getHelperText(false)
  const exportHelperText = getHelperText(true)
  const shareHelperText = getHelperText(true)

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>Actions</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 sm:right-0 bg-surface border border-subtle rounded-lg shadow-premium-lg z-50 min-w-[200px] max-w-[calc(100vw-2rem)] overflow-hidden">
          <div className="p-1">
            {/* Set Alert */}
            <button
              className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm flex items-center justify-between ${
                setAlertDisabled ? 'opacity-70 cursor-not-allowed text-foreground/60' : ''
              }`}
              onClick={handleSetAlert}
              disabled={setAlertDisabled}
              title={setAlertHelperText}
            >
              <span>Set Alert</span>
              {setAlertHelperText && <span className="ml-auto text-xs text-muted-foreground">{setAlertHelperText}</span>}
            </button>

            {/* Export Data */}
            <button
              className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm flex items-center justify-between ${
                exportDisabled ? 'opacity-70 cursor-not-allowed text-foreground/60' : ''
              }`}
              onClick={handleExportData}
              disabled={exportDisabled}
              title={exportHelperText}
            >
              <span>Export Data</span>
              {exportHelperText && <span className="ml-auto text-xs text-muted-foreground">{exportHelperText}</span>}
            </button>

            {/* Share Report */}
            <button
              className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm flex items-center justify-between ${
                shareDisabled ? 'opacity-70 cursor-not-allowed text-foreground/60' : ''
              }`}
              onClick={handleShareReport}
              disabled={shareDisabled}
              title={shareHelperText}
            >
              <span>Share Report</span>
              {shareHelperText && <span className="ml-auto text-xs text-muted-foreground">{shareHelperText}</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

