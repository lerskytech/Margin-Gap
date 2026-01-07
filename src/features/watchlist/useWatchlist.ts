import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { WatchlistItem } from '@/lib/types'
import { devError } from '@/lib/devLog'

export function useWatchlist(userId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: watchlist, isLoading } = useQuery({
    queryKey: ['watchlist', userId],
    queryFn: async () => {
      if (!userId || !supabase) return []
      
      try {
        const { data, error } = await supabase
          .from('watchlist')
          .select(`
            *,
            products (*)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) {
          devError('Error fetching watchlist:', error)
          throw error
        }
        return (Array.isArray(data) ? data : []) as WatchlistItem[]
      } catch (error) {
        devError('Failed to fetch watchlist:', error)
        return []
      }
    },
    enabled: !!userId,
    retry: 1,
  })

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      if (!productId) throw new Error('Product ID is required')
      
      try {
        const { error } = await supabase
          .from('watchlist')
          .insert({ user_id: userId, product_id: productId } as any)

        if (error) {
          devError('Error adding to watchlist:', error)
          throw error
        }
      } catch (error) {
        devError('Failed to add to watchlist:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', userId] })
    },
    onError: (error) => {
      devError('Add to watchlist mutation error:', error)
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (watchlistId: string) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      if (!watchlistId) throw new Error('Watchlist ID is required')
      
      try {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('id', watchlistId)
          .eq('user_id', userId)

        if (error) {
          devError('Error removing from watchlist:', error)
          throw error
        }
      } catch (error) {
        devError('Failed to remove from watchlist:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', userId] })
    },
    onError: (error) => {
      devError('Remove from watchlist mutation error:', error)
    },
  })

  return {
    watchlist: watchlist || [],
    isLoading,
    addToWatchlist: addMutation.mutateAsync,
    removeFromWatchlist: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  }
}
