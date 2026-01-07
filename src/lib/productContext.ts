// Product context utilities for category inference and suggestions

export interface ProductContext {
  category: string
  categoryPath: string
  dataSources: string[]
  marketScope: string
}

/**
 * Infer product category from query string
 */
export function inferCategory(query: string): { category: string; categoryPath: string } {
  const lowerQuery = query.toLowerCase()
  
  // Smartphones
  if (lowerQuery.includes('iphone') || lowerQuery.includes('samsung galaxy') || 
      lowerQuery.includes('pixel') || lowerQuery.includes('oneplus') ||
      lowerQuery.includes('android phone') || lowerQuery.includes('smartphone')) {
    return {
      category: 'Smartphones',
      categoryPath: 'Consumer Electronics → Smartphones',
    }
  }
  
  // Gaming Consoles
  if (lowerQuery.includes('playstation') || lowerQuery.includes('ps5') || 
      lowerQuery.includes('ps4') || lowerQuery.includes('xbox') ||
      lowerQuery.includes('nintendo switch') || lowerQuery.includes('steam deck')) {
    return {
      category: 'Gaming Consoles',
      categoryPath: 'Electronics → Gaming Consoles',
    }
  }
  
  // Footwear
  if (lowerQuery.includes('jordan') || lowerQuery.includes('nike') || 
      lowerQuery.includes('adidas') || lowerQuery.includes('yeezy') ||
      lowerQuery.includes('sneaker') || lowerQuery.includes('shoe')) {
    return {
      category: 'Footwear',
      categoryPath: 'Fashion → Footwear',
    }
  }
  
  // Laptops/Computers
  if (lowerQuery.includes('macbook') || lowerQuery.includes('laptop') || 
      lowerQuery.includes('thinkpad') || lowerQuery.includes('surface') ||
      lowerQuery.includes('chromebook') || lowerQuery.includes('dell xps')) {
    return {
      category: 'Computers',
      categoryPath: 'Electronics → Computers',
    }
  }
  
  // Collectibles
  if (lowerQuery.includes('pokémon') || lowerQuery.includes('pokemon') || 
      lowerQuery.includes('trading card') || lowerQuery.includes('funko') ||
      lowerQuery.includes('collectible')) {
    return {
      category: 'Collectibles',
      categoryPath: 'Collectibles → Trading Cards & Toys',
    }
  }
  
  // Electronics (general)
  if (lowerQuery.includes('tablet') || lowerQuery.includes('ipad') || 
      lowerQuery.includes('headphone') || lowerQuery.includes('earbud') ||
      lowerQuery.includes('watch') || lowerQuery.includes('camera')) {
    return {
      category: 'Consumer Electronics',
      categoryPath: 'Consumer Electronics → General',
    }
  }
  
  // Default
  return {
    category: 'General Consumer Product',
    categoryPath: 'General Consumer Product',
  }
}

/**
 * Extract data sources from aggregates
 */
export function extractDataSources(aggregates: Array<{ source_type: string }>): string[] {
  const sources = new Set<string>()
  
  aggregates.forEach(agg => {
    if (agg.source_type === 'ebay_active' || agg.source_type === 'ebay_sold') {
      sources.add('eBay')
    } else if (agg.source_type === 'facebook_marketplace') {
      sources.add('Facebook Marketplace')
    } else if (agg.source_type === 'offerup') {
      sources.add('OfferUp')
    } else if (agg.source_type === 'mercari') {
      sources.add('Mercari')
    } else if (agg.source_type === 'amazon_new') {
      sources.add('Amazon')
    }
  })
  
  return Array.from(sources)
}

/**
 * Get suggested related products based on query
 */
export function getSuggestedScans(query: string): string[] {
  const lowerQuery = query.toLowerCase()
  const suggestions: string[] = []
  
  // iPhone family
  if (lowerQuery.includes('iphone')) {
    if (!lowerQuery.includes('13')) suggestions.push('iPhone 13')
    if (!lowerQuery.includes('12')) suggestions.push('iPhone 12')
    if (!lowerQuery.includes('14')) suggestions.push('iPhone 14')
    if (!lowerQuery.includes('pro')) suggestions.push('iPhone 13 Pro')
  }
  
  // Samsung Galaxy family
  if (lowerQuery.includes('galaxy') || lowerQuery.includes('samsung')) {
    if (!lowerQuery.includes('s22')) suggestions.push('Samsung Galaxy S22')
    if (!lowerQuery.includes('s21')) suggestions.push('Samsung Galaxy S21')
    if (!lowerQuery.includes('s23')) suggestions.push('Samsung Galaxy S23')
  }
  
  // Pixel family
  if (lowerQuery.includes('pixel')) {
    if (!lowerQuery.includes('7')) suggestions.push('Pixel 7')
    if (!lowerQuery.includes('6')) suggestions.push('Pixel 6')
    if (!lowerQuery.includes('8')) suggestions.push('Pixel 8')
  }
  
  // PlayStation family
  if (lowerQuery.includes('playstation') || lowerQuery.includes('ps')) {
    if (!lowerQuery.includes('5')) suggestions.push('PlayStation 5')
    if (!lowerQuery.includes('4')) suggestions.push('PlayStation 4')
  }
  
  // Nintendo Switch family
  if (lowerQuery.includes('switch') || lowerQuery.includes('nintendo')) {
    if (!lowerQuery.includes('oled')) suggestions.push('Nintendo Switch OLED')
    if (!lowerQuery.includes('lite')) suggestions.push('Nintendo Switch Lite')
  }
  
  // Air Jordan family
  if (lowerQuery.includes('jordan') || lowerQuery.includes('air jordan')) {
    if (!lowerQuery.includes('1')) suggestions.push('Air Jordan 1 Retro High')
    if (!lowerQuery.includes('4')) suggestions.push('Air Jordan 4')
  }
  
  // MacBook family
  if (lowerQuery.includes('macbook')) {
    if (!lowerQuery.includes('m1')) suggestions.push('MacBook Air M1')
    if (!lowerQuery.includes('m2')) suggestions.push('MacBook Air M2')
    if (!lowerQuery.includes('pro')) suggestions.push('MacBook Pro')
  }
  
  return suggestions.slice(0, 4) // Limit to 4 suggestions
}

/**
 * Get line description for chart legend
 */
export function getLineDescription(lineName: string): string {
  const descriptions: Record<string, string> = {
    'MSRP': 'Manufacturer Suggested Retail Price (static baseline)',
    'Baseline': 'Manufacturer Suggested Retail Price (static baseline)',
    'eBay Active (Used)': 'Current average asking price across live listings',
    'eBay Active (New)': 'Current average asking price for new items',
    'eBay Active': 'Current average asking price across live listings',
    'eBay Sold': 'Historical sold prices (completed listings)',
    'National Used': 'Average used price across national market',
    'Local Used': 'Average used price in local market',
    'Shippable': 'Listings available for national shipping',
    'New': 'Average price for new condition items',
    'Category Benchmark': 'Category-wide pricing benchmark',
  }
  
  return descriptions[lineName] || 'Price trend data'
}

