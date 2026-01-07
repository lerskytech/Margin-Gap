import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { Drawer } from '@/components/ui/Drawer'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      >
        Skip to content
      </a>
      <TopBar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 border-r border-subtle bg-surface/30">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar Drawer */}
        <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Menu">
          <Sidebar />
        </Drawer>

        <main id="main-content" role="main" className="flex-1 p-3 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
