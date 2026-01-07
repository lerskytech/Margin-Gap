// XML parsing utilities for Supabase Edge Functions (Deno)
// Uses DOMParser if available, otherwise falls back to a simple regex-based parser

interface XmlParseResult {
  document?: any
  error?: string
}

export function parseXml(xml: string): XmlParseResult {
  try {
    // Try using DOMParser (available in Deno with --allow-net and dom types)
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      
      // Check for parsing errors
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        return {
          error: `XML Parse Error: ${text(parserError, '', 'Unknown error')}`,
        }
      }
      
      return { document: doc }
    }
    
    // Fallback: Simple regex-based XML parser for basic structure
    // This is a minimal implementation for eBay Finding API responses
    return { document: parseXmlSimple(xml) }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown XML parse error',
    }
  }
}

function parseXmlSimple(xml: string): any {
  // Simple XML parser for eBay Finding API structure
  // This handles the specific XML structure we need
  const result: any = {}
  
  // Extract items using regex (simple but works for our use case)
  const itemMatches = xml.match(/<item[^>]*>([\s\S]*?)<\/item>/gi)
  if (itemMatches) {
    result.items = itemMatches.map(parseItemSimple)
  }
  
  // Extract ack
  const ackMatch = xml.match(/<ack[^>]*>([^<]+)<\/ack>/i)
  if (ackMatch) {
    result.ack = ackMatch[1].trim()
  }
  
  // Extract total entries
  const totalMatch = xml.match(/<totalEntries[^>]*>([^<]+)<\/totalEntries>/i)
  if (totalMatch) {
    result.totalEntries = parseInt(totalMatch[1].trim(), 10)
  }
  
  return result
}

function parseItemSimple(itemXml: string): any {
  const item: any = {}
  
  // Title
  const titleMatch = itemXml.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    item.title = titleMatch[1].trim()
  }
  
  // Item ID
  const itemIdMatch = itemXml.match(/<itemId[^>]*>([^<]+)<\/itemId>/i)
  if (itemIdMatch) {
    item.itemId = itemIdMatch[1].trim()
  }
  
  // View Item URL
  const viewUrlMatch = itemXml.match(/<viewItemURL[^>]*><!\[CDATA\[(.*?)\]\]><\/viewItemURL>/i) || itemXml.match(/<viewItemURL[^>]*>([^<]+)<\/viewItemURL>/i)
  if (viewUrlMatch) {
    item.viewItemURL = viewUrlMatch[1].trim()
  }
  
  // Gallery URL
  const galleryMatch = itemXml.match(/<galleryURL[^>]*><!\[CDATA\[(.*?)\]\]><\/galleryURL>/i) || itemXml.match(/<galleryURL[^>]*>([^<]+)<\/galleryURL>/i)
  if (galleryMatch) {
    item.galleryURL = galleryMatch[1].trim()
  }
  
  // Price
  const priceMatch = itemXml.match(/<currentPrice[^>]*currencyId="([^"]*)"[^>]*>([^<]+)<\/currentPrice>/i)
  if (priceMatch) {
    item.price = {
      value: priceMatch[2].trim(),
      currency: priceMatch[1].trim(),
    }
  }
  
  // Shipping cost
  const shippingMatch = itemXml.match(/<shippingServiceCost[^>]*currencyId="([^"]*)"[^>]*>([^<]+)<\/shippingServiceCost>/i)
  if (shippingMatch) {
    item.shippingCost = {
      value: shippingMatch[2].trim(),
      currency: shippingMatch[1].trim(),
    }
  }
  
  // Condition
  const conditionMatch = itemXml.match(/<conditionDisplayName[^>]*><!\[CDATA\[(.*?)\]\]><\/conditionDisplayName>/i) || itemXml.match(/<conditionDisplayName[^>]*>([^<]+)<\/conditionDisplayName>/i)
  if (conditionMatch) {
    item.conditionDisplayName = conditionMatch[1].trim()
  }
  
  const conditionIdMatch = itemXml.match(/<conditionId[^>]*>([^<]+)<\/conditionId>/i)
  if (conditionIdMatch) {
    item.conditionId = conditionIdMatch[1].trim()
  }
  
  // Location
  const locationMatch = itemXml.match(/<location[^>]*><!\[CDATA\[(.*?)\]\]><\/location>/i) || itemXml.match(/<location[^>]*>([^<]+)<\/location>/i)
  if (locationMatch) {
    item.location = locationMatch[1].trim()
  }
  
  // End time
  const endTimeMatch = itemXml.match(/<endTime[^>]*>([^<]+)<\/endTime>/i)
  if (endTimeMatch) {
    item.endTime = endTimeMatch[1].trim()
  }
  
  return item
}

export function text(el: any, selector: string, fallback: string = ''): string {
  if (!el) return fallback
  
  try {
    if (typeof el.querySelector === 'function') {
      const found = el.querySelector(selector)
      if (found) {
        return found.textContent?.trim() || fallback
      }
    }
  } catch (error) {
    // Ignore
  }
  
  return fallback
}

export function attr(el: any, name: string, fallback: string = ''): string {
  if (!el) return fallback
  
  try {
    if (el.getAttribute) {
      return el.getAttribute(name) || fallback
    }
  } catch (error) {
    // Ignore
  }
  
  return fallback
}

export function queryAll(root: any, selector: string): any[] {
  if (!root) return []
  
  try {
    if (typeof root.querySelectorAll === 'function') {
      return Array.from(root.querySelectorAll(selector))
    }
  } catch (error) {
    // Ignore
  }
  
  return []
}
