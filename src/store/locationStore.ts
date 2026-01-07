import { create } from 'zustand'
import type { LocationMode } from '@/lib/location'
import {
  DEFAULT_LOCATION,
  getLocationKey,
  serializeLocation,
  deserializeLocation,
} from '@/lib/location'
import { supabase, supabaseEnabled } from '@/services/supabase'

const STORAGE_KEY = 'margingap_location_mode'
const RECENT_KEY = 'margingap_recent_locations'
const MAX_RECENT = 10

interface LocationState {
  mode: LocationMode
  recent: LocationMode[]
  initialized: boolean
  loading: boolean
  
  // Actions
  initialize: (userId?: string) => Promise<void>
  setMode: (mode: LocationMode) => void
  addRecent: (mode: LocationMode) => void
  removeRecent: (mode: LocationMode) => void
  setDefault: (mode: LocationMode, userId?: string) => Promise<void>
  clearRecent: () => void
}

export const useLocationStore = create<LocationState>((set, get) => ({
  mode: DEFAULT_LOCATION,
  recent: [],
  initialized: false,
  loading: false,

  initialize: async (userId?: string) => {
    if (get().initialized) return
    
    set({ loading: true })
    
    try {
      let loadedMode: LocationMode | null = null
      let loadedRecent: LocationMode[] = []
      
      // Try to load from Supabase if authenticated
      if (userId && supabaseEnabled && supabase) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('default_location')
            .eq('id', userId)
            .single()
          
          if (profile?.default_location) {
            loadedMode = profile.default_location as LocationMode
          }
        } catch {
          // Profile might not have default_location column yet, fall back to localStorage
        }
      }
      
      // Fall back to localStorage
      if (!loadedMode) {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          loadedMode = deserializeLocation(stored)
        }
      }
      
      // Load recent locations from localStorage
      const recentStored = localStorage.getItem(RECENT_KEY)
      if (recentStored) {
        try {
          const parsed = JSON.parse(recentStored)
          if (Array.isArray(parsed)) {
            loadedRecent = parsed
              .map(item => deserializeLocation(JSON.stringify(item)))
              .filter((loc): loc is LocationMode => loc !== null)
              .slice(0, MAX_RECENT)
          }
        } catch {
          // Invalid JSON
        }
      }
      
      set({
        mode: loadedMode || DEFAULT_LOCATION,
        recent: loadedRecent,
        initialized: true,
        loading: false,
      })
      
      // Sync to extension if available
      syncToExtension(loadedMode || DEFAULT_LOCATION, loadedRecent)
      
    } catch (error) {
      console.error('Failed to initialize location store:', error)
      set({
        mode: DEFAULT_LOCATION,
        recent: [],
        initialized: true,
        loading: false,
      })
    }
  },

  setMode: (mode) => {
    set({ mode })
    
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, serializeLocation(mode))
    
    // Add to recent (if not national)
    if (mode.kind !== 'national') {
      get().addRecent(mode)
    }
    
    // Sync to extension
    syncToExtension(mode, get().recent)
  },

  addRecent: (mode) => {
    if (mode.kind === 'national') return
    
    const { recent } = get()
    const key = getLocationKey(mode)
    
    // Remove existing entry with same key
    const filtered = recent.filter(r => getLocationKey(r) !== key)
    
    // Add to front
    const newRecent = [mode, ...filtered].slice(0, MAX_RECENT)
    
    set({ recent: newRecent })
    
    // Persist to localStorage
    localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent))
    
    // Sync to extension
    syncToExtension(get().mode, newRecent)
  },

  removeRecent: (mode) => {
    const { recent } = get()
    const key = getLocationKey(mode)
    const filtered = recent.filter(r => getLocationKey(r) !== key)
    
    set({ recent: filtered })
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered))
    
    // Sync to extension
    syncToExtension(get().mode, filtered)
  },

  setDefault: async (mode, userId) => {
    // Set as current mode
    get().setMode(mode)
    
    // Persist to Supabase if authenticated
    if (userId && supabaseEnabled && supabase) {
      try {
        await supabase
          .from('profiles')
          .update({ default_location: mode })
          .eq('id', userId)
      } catch (error) {
        console.error('Failed to save default location to Supabase:', error)
        // Continue anyway - localStorage is the fallback
      }
    }
  },

  clearRecent: () => {
    set({ recent: [] })
    localStorage.removeItem(RECENT_KEY)
    syncToExtension(get().mode, [])
  },
}))

/**
 * Sync location to Chrome extension storage (if available)
 */
function syncToExtension(mode: LocationMode, recent: LocationMode[]) {
  try {
    // Check if we're in a context where chrome.storage is available
    // Use type assertion to avoid conflicts with other chrome type declarations
    const chromeObj = (window as { chrome?: { storage?: { sync?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome
    if (typeof window !== 'undefined' && chromeObj?.storage?.sync) {
      chromeObj.storage.sync.set({
        mg_location_mode: mode,
        mg_recent_locations: recent,
      }).catch(() => {
        // Silently fail - extension might not be installed
      })
    }
  } catch {
    // Not in extension context or no permissions
  }
}

