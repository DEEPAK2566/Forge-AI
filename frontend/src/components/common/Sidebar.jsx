import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutGrid, Rocket, Layers, Compass, Zap, LogOut, History } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const navItems = [
  { icon: LayoutGrid, label: 'My Space', path: '/myspace'  },
  { icon: Rocket,     label: 'Build',    path: '/build'    },
  { icon: Compass,    label: 'Discover', path: '/discover' },
  { icon: History,    label: 'Runs',     path: '/executions' },
]

export default function Sidebar() {
  const navigate          = useNavigate()
  const { user, logout }  = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initial = user?.full_name?.[0]?.toUpperCase()
               || user?.email?.[0]?.toUpperCase()
               || 'U'

  return (
    <aside style={{
      // var(--sidebar-width) reads from CSS variables in index.css
      // — automatically becomes 60px on tablets, 80px on desktop
      width: 'var(--sidebar-width, 80px)',
      minHeight: '100vh',
      backgroundColor: '#0D0D14',
      borderRight: '1px solid #2A2A3D',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px 0',
      flexShrink: 0,       // never shrink the sidebar
      zIndex: 100,
      transition: 'width 0.2s ease',  // smooth resize animation
    }}>

      {/* Logo */}
      <div style={{
        marginBottom: '28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
      }}>
        <div style={{
          width: '38px', height: '38px',
          borderRadius: '11px',
          background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(124,58,237,0.4)',
          flexShrink: 0,
        }}>
          <Zap size={20} color="white" fill="white" />
        </div>
        <span style={{
          fontSize: '8px', fontWeight: '700',
          color: '#7C3AED', letterSpacing: '2.5px',
          // hide the text on very small screens
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}>
          FORGE
        </span>
      </div>

      {/* Navigation */}
      <nav style={{
        display: 'flex', flexDirection: 'column',
        gap: '2px', width: '100%', padding: '0 8px',
        flex: 1,
      }}>
        {navItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            title={label}  // tooltip on hover — useful when sidebar is narrow
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '4px',
              padding: '11px 0', borderRadius: '10px',
              textDecoration: 'none',
              color:           isActive ? '#F0F0FF' : '#5A5A7A',
              backgroundColor: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
              transition: 'all 0.2s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} color={isActive ? '#7C3AED' : '#5A5A7A'} />
                <span style={{
                  fontSize: '9px', fontWeight: '500',
                  letterSpacing: '0.3px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: logout + avatar */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '8px',
        padding: '0 0 4px',
      }}>
        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: 'transparent',
            border: '1px solid #2A2A3D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#EF4444'
            e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#2A2A3D'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={13} color="#5A5A7A" />
        </button>

        {/* User avatar */}
        <div
          title={user?.email || ''}
          style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '600', color: 'white',
            boxShadow: '0 0 12px rgba(124,58,237,0.3)',
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
      </div>
    </aside>
  )
}