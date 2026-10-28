import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0D0D14',
      overflow: 'hidden',
    }}>
      <Sidebar />

      {/* 
        flex: 1          → take all remaining width after the sidebar
        overflowY: auto  → this area scrolls vertically
        overflowX: hidden → never scroll horizontally
        width: 0         → this is a CSS trick — without it, flex children
                           can overflow their parent on some browsers
      */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        width: 0,
      }}>
        <Outlet />
      </main>
    </div>
  )
}