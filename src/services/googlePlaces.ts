// Google Places API service (stubbed with mock data)
// Replace with actual Google Places API integration when ready

export interface Place {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
  types: string[]
}

export interface Location {
  city?: string
  state?: string
  zip?: string
  region_key: string
}

const MOCK_LOCATIONS: Location[] = [
  { city: 'Miami', state: 'FL', zip: '33139', region_key: 'US:FL:Miami' },
  { city: 'New York', state: 'NY', zip: '10001', region_key: 'US:NY:NewYork' },
  { city: 'Los Angeles', state: 'CA', zip: '90001', region_key: 'US:CA:LosAngeles' },
  { city: 'Chicago', state: 'IL', zip: '60601', region_key: 'US:IL:Chicago' },
  { city: 'Houston', state: 'TX', zip: '77001', region_key: 'US:TX:Houston' },
]

export const googlePlacesService = {
  async searchPlaces(query: string): Promise<Place[]> {
    // Mock implementation - replace with actual Google Places API
    if (!query) return []
    
    const filtered = MOCK_LOCATIONS.filter(loc => 
      loc.city?.toLowerCase().includes(query.toLowerCase()) ||
      loc.state?.toLowerCase().includes(query.toLowerCase()) ||
      loc.zip?.includes(query)
    )
    
    return filtered.map(loc => ({
      place_id: loc.region_key,
      description: `${loc.city}, ${loc.state} ${loc.zip}`,
      main_text: loc.city || loc.zip || '',
      secondary_text: `${loc.state} ${loc.zip}`,
      types: ['locality', 'postal_code'],
    }))
  },

  async getLocationByZip(zip: string): Promise<Location | null> {
    const location = MOCK_LOCATIONS.find(loc => loc.zip === zip)
    return location || null
  },

  async getLocationByCityState(city: string, state: string): Promise<Location | null> {
    const location = MOCK_LOCATIONS.find(
      loc => loc.city?.toLowerCase() === city.toLowerCase() && 
      loc.state?.toUpperCase() === state.toUpperCase()
    )
    return location || null
  },

  getMockLocations(): Location[] {
    return MOCK_LOCATIONS
  },
}
