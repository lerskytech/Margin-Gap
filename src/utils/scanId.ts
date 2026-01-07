// Generate stable client-side scan ID

export function generateScanId(query: string, regionKey: string = 'US'): string {
  const timestamp = Date.now()
  const hash = simpleHash(query + regionKey)
  return `${timestamp}-${hash}`
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8)
}

