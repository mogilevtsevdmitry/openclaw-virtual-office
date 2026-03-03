import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'

function getActiveItem(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard'
  return pathname.split('/')[1] || 'dashboard'
}

export function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeItem = getActiveItem(location.pathname)
  const isFullHeight = activeItem === 'office' || activeItem === 'chat' || activeItem === 'game'

  const handleNavClick = (itemId: string) => {
    navigate(itemId === 'dashboard' ? '/' : `/${itemId}`)
  }

  return (
    <div
      className="dashboard-root flex h-screen w-screen overflow-hidden"
      style={{ backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
    >
      {/* Sidebar */}
      <SideNav
        activeItem={activeItem}
        onItemClick={handleNavClick}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area — offset for fixed sidebar on desktop */}
      <div className="flex flex-col min-w-0 overflow-hidden" style={{ flex: 1, marginLeft: 0 }}>
        {/* TopBar — hidden when in Office (Phaser has its own UI) */}
        {!isFullHeight && (
          <TopBar onMenuClick={() => setMobileOpen(true)} />
        )}

        {/* Content area */}
        <main
          className={isFullHeight ? '' : 'flex-1 overflow-y-auto overflow-x-hidden'}
          style={isFullHeight ? { flex: 1, position: 'relative', overflow: 'hidden' } : {}}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
