import { useState } from 'react'
import { useWatchlistFolders, useWatchlistItems } from '@/store/watchlistStore'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/ui/Button'
import { Card, CardContent } from '@/ui/Card'

interface WatchlistSidebarProps {
  onItemClick?: (item: { productKey: string; regionKey: string; title: string }) => void
}

export function WatchlistSidebar({ onItemClick }: WatchlistSidebarProps) {
  const { user } = useAuthStore()
  const { folders, isLoading: foldersLoading, ensureDefaultFolder } = useWatchlistFolders(user?.id)
  const { items, isLoading: itemsLoading } = useWatchlistItems(user?.id)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Ensure default folder exists
  if (user && folders.length === 0 && !foldersLoading) {
    ensureDefaultFolder()
  }

  const filteredItems = selectedFolderId
    ? items.filter(item => item.folder_id === selectedFolderId)
    : items

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) return
    // Implementation would call createFolder from useWatchlistFolders
    setShowNewFolder(false)
    setNewFolderName('')
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Sign in to use watchlist</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Watchlists</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewFolder(!showNewFolder)}
        >
          + Folder
        </Button>
      </div>

      {showNewFolder && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewFolder()
              if (e.key === 'Escape') setShowNewFolder(false)
            }}
            autoFocus
          />
          <Button size="sm" onClick={handleNewFolder}>Add</Button>
        </div>
      )}

      <div className="space-y-1">
        <button
          onClick={() => setSelectedFolderId(undefined)}
          className={`w-full text-left px-2 py-1 rounded text-sm ${
            selectedFolderId === undefined ? 'bg-primary/10' : 'hover:bg-secondary'
          }`}
        >
          All Items
        </button>
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => setSelectedFolderId(folder.id)}
            className={`w-full text-left px-2 py-1 rounded text-sm ${
              selectedFolderId === folder.id ? 'bg-primary/10' : 'hover:bg-secondary'
            }`}
          >
            {folder.name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {itemsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in watchlist</p>
        ) : (
          filteredItems.map(item => (
            <Card
              key={item.id}
              className="cursor-pointer hover:bg-secondary transition-colors"
              onClick={() => onItemClick?.({
                productKey: item.product_key,
                regionKey: item.region_key,
                title: item.title,
              })}
            >
              <CardContent className="p-3">
                <div className="text-sm font-medium truncate">{item.title}</div>
                {item.last_price && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${item.last_price.toFixed(2)}
                    {item.last_change_pct !== null && item.last_change_pct !== undefined && (
                      <span className={item.last_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {' '}
                        {item.last_change_pct >= 0 ? '+' : ''}
                        {item.last_change_pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

