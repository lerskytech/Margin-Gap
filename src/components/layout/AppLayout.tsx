import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
