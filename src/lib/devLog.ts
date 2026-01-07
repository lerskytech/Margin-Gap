// Development-only logging utility
export function devLog(...args: any[]): void {
  if (import.meta.env.DEV) {
    console.log('[DEV]', ...args)
  }
}

export function devError(...args: any[]): void {
  if (import.meta.env.DEV) {
    console.error('[DEV ERROR]', ...args)
  }
}

export function devWarn(...args: any[]): void {
  if (import.meta.env.DEV) {
    console.warn('[DEV WARN]', ...args)
  }
}

