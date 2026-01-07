import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from '@/ui/Button'
import type { LocationMode } from '@/lib/location'
import {
  TOP_CITIES,
  getLocationLabel,
  getLocationShortLabel,
  getLocationKey,
  parseLocationInput,
} from '@/lib/location'

interface LocationSwitcherProps {
  value: LocationMode
  onChange: (mode: LocationMode) => void
  recent: LocationMode[]
  onSetDefault?: (mode: LocationMode) => void
  onRemoveRecent?: (mode: LocationMode) => void
  disabled?: boolean
}

export function LocationSwitcher({
  value,
  onChange,
  recent,
  onSetDefault,
  onRemoveRecent,
  disabled = false,
}: LocationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setInputValue('')
        setInputError(null)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setInputValue('')
        setInputError(null)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Filter top cities based on input
  const filteredCities = useMemo(() => {
    if (!inputValue) return TOP_CITIES.slice(0, 8)
    const lower = inputValue.toLowerCase()
    return TOP_CITIES.filter(
      city => city.kind === 'city' && city.label.toLowerCase().includes(lower)
    ).slice(0, 8)
  }, [inputValue])

  const handleSelect = (mode: LocationMode) => {
    onChange(mode)
    setIsOpen(false)
    setInputValue('')
    setInputError(null)
  }

  const handleInputSubmit = () => {
    if (!inputValue.trim()) return
    
    const parsed = parseLocationInput(inputValue)
    if (parsed) {
      handleSelect(parsed)
    } else {
      setInputError('Enter a ZIP code (e.g., 33131) or city (e.g., Miami, FL)')
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputSubmit()
    }
  }

  const currentLabel = getLocationShortLabel(value)
  const isNational = value.kind === 'national'

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-1.5 min-w-[80px]"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs font-medium">{currentLabel}</span>
        <svg
          className="w-3 h-3 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-surface border border-subtle rounded-lg shadow-premium-lg z-50 w-[280px] overflow-hidden">
          {/* Input */}
          <div className="p-2 border-b border-subtle">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setInputError(null)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="ZIP or City, ST"
              className="w-full px-3 py-2 text-sm bg-surface2 border border-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {inputError && (
              <p className="mt-1 text-xs text-red-500">{inputError}</p>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {/* National option */}
            <div className="p-1">
              <button
                className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm flex items-center justify-between ${
                  isNational ? 'bg-primary/10 text-primary' : ''
                }`}
                onClick={() => handleSelect({ kind: 'national' })}
              >
                <span>🇺🇸 National (US)</span>
                {isNational && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            {/* Recent locations */}
            {recent.length > 0 && (
              <div className="p-1 border-t border-subtle">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </div>
                {recent.map((loc) => {
                  const key = getLocationKey(loc)
                  const isSelected = getLocationKey(value) === key
                  return (
                    <div key={key} className="flex items-center group">
                      <button
                        className={`flex-1 text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm ${
                          isSelected ? 'bg-primary/10 text-primary' : ''
                        }`}
                        onClick={() => handleSelect(loc)}
                      >
                        {getLocationLabel(loc)}
                      </button>
                      {onRemoveRecent && (
                        <button
                          className="p-1 mr-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 rounded transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveRecent(loc)
                          }}
                          title="Remove"
                        >
                          <svg className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Top cities */}
            <div className="p-1 border-t border-subtle">
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {inputValue ? 'Matching Cities' : 'Top Cities'}
              </div>
              {filteredCities.length > 0 ? (
                filteredCities.map((loc) => {
                  const key = getLocationKey(loc)
                  const isSelected = getLocationKey(value) === key
                  return (
                    <button
                      key={key}
                      className={`w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-sm ${
                        isSelected ? 'bg-primary/10 text-primary' : ''
                      }`}
                      onClick={() => handleSelect(loc)}
                    >
                      {getLocationLabel(loc)}
                    </button>
                  )
                })
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">No matching cities</p>
              )}
            </div>
          </div>

          {/* Set as default */}
          {value.kind !== 'national' && onSetDefault && (
            <div className="p-2 border-t border-subtle">
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onSetDefault(value)}
              >
                Set "{getLocationLabel(value)}" as default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

