import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { WatchlistFolder, WatchlistItem } from '@/lib/types'
import { devError } from '@/lib/devLog'

export function useWatchlistFolders(userId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['watchlist-folders', userId],
    queryFn: async () => {
      if (!userId || !supabase) return []
      
      try {
        const { data, error } = await supabase
          .from('watchlist_folders')
          .select('*')
          .eq('user_id', userId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) {
          devError('Error fetching watchlist folders:', error)
          throw error
        }
        return (Array.isArray(data) ? data : []) as WatchlistFolder[]
      } catch (error) {
        devError('Failed to fetch watchlist folders:', error)
        return []
      }
    },
    enabled: !!userId,
    retry: 1,
  })

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      if (!name || !name.trim()) throw new Error('Folder name cannot be empty')
      
      try {
        const { data, error } = await supabase
          .from('watchlist_folders')
          .insert({
            user_id: userId,
            name: name.trim(),
            sort_order: Array.isArray(folders) ? folders.length : 0,
          } as any)
          .select()
          .single()

        if (error) {
          devError('Error creating folder:', error)
          throw error
        }
        if (!data) {
          throw new Error('Failed to create folder')
        }
        return data as WatchlistFolder
      } catch (error) {
        devError('Failed to create folder:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-folders', userId] })
    },
    onError: (error) => {
      devError('Create folder mutation error:', error)
    },
  })

  const updateFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      
      const { data, error } = await supabase
        .from('watchlist_folders')
        .update({ name } as any)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data as WatchlistFolder
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-folders', userId] })
    },
  })

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      
      const { error } = await supabase
        .from('watchlist_folders')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-folders', userId] })
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', userId] })
    },
  })

  // Ensure default "Favorites" folder exists
  const ensureDefaultFolder = useMutation({
    mutationFn: async () => {
      if (!userId || !supabase) return null
      
      const existing = folders.find(f => f.name === 'Favorites')
      if (existing) return existing

      const { data, error } = await supabase
        .from('watchlist_folders')
        .insert({
          user_id: userId,
          name: 'Favorites',
          sort_order: 0,
        } as any)
        .select()
        .single()

      if (error && !error.message.includes('duplicate')) throw error
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['watchlist-folders', userId] })
        return data as WatchlistFolder
      }
      return null
    },
  })

  return {
    folders,
    isLoading,
    createFolder: createFolder.mutateAsync,
    updateFolder: updateFolder.mutateAsync,
    deleteFolder: deleteFolder.mutateAsync,
    ensureDefaultFolder: ensureDefaultFolder.mutateAsync,
  }
}

export function useWatchlistItems(userId: string | undefined, folderId?: string) {
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['watchlist-items', userId, folderId],
    queryFn: async () => {
      if (!userId || !supabase) return []
      
      try {
        let query = supabase
          .from('watchlist_items')
          .select(`
            *,
            folder:watchlist_folders(*)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (folderId) {
          query = query.eq('folder_id', folderId)
        }

        const { data, error } = await query

        if (error) {
          devError('Error fetching watchlist items:', error)
          throw error
        }
        return (Array.isArray(data) ? data : []) as WatchlistItem[]
      } catch (error) {
        devError('Failed to fetch watchlist items:', error)
        return []
      }
    },
    enabled: !!userId,
    retry: 1,
  })

  const addItem = useMutation({
    mutationFn: async ({
      productKey,
      title,
      imageUrl,
      regionKey = 'US',
      folderId,
    }: {
      productKey: string
      title: string
      imageUrl?: string
      regionKey?: string
      folderId?: string
    }) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      
      const { data, error } = await supabase
        .from('watchlist_items')
        .insert({
          user_id: userId,
          product_key: productKey,
          title,
          image_url: imageUrl,
          region_key: regionKey,
          folder_id: folderId,
        } as any)
        .select()
        .single()

      if (error) throw error
      return data as WatchlistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', userId] })
    },
  })

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      
      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', userId] })
    },
  })

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      folderId,
      lastPrice,
      lastChangePct,
    }: {
      id: string
      folderId?: string | null
      lastPrice?: number
      lastChangePct?: number
    }) => {
      if (!userId || !supabase) throw new Error('Not authenticated')
      
      const updates: any = {}
      if (folderId !== undefined) updates.folder_id = folderId
      if (lastPrice !== undefined) updates.last_price = lastPrice
      if (lastChangePct !== undefined) updates.last_change_pct = lastChangePct

      const { data, error } = await supabase
        .from('watchlist_items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data as WatchlistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-items', userId] })
    },
  })

  return {
    items,
    isLoading,
    addItem: addItem.mutateAsync,
    removeItem: removeItem.mutateAsync,
    updateItem: updateItem.mutateAsync,
  }
}

