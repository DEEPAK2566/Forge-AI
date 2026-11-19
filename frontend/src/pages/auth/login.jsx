import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Mail, Lock, AlertCircle } from 'lucide-react'
import authService from '../../services/authService'
import useAuthStore from '../../store/authStore'
import { APP_NAME } from '../../config/brand'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // useNavigate: programmatically navigate to another page
  const navigate = useNavigate()

  // Get the login action from our auth store
  const storeLogin = useAuthStore((state) => state.login)

  const inputStyle = {
    width: '100%', backgroundColor: '#1A1A2E',
    border: '1px solid #2A2A3D', borderRadius: '10px',
    padding: '11px 14px 11px 40px', color: '#F0F0FF', fontSize: '14px',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Call POST /auth/login via authService
      const data = await authService.login(email, password)

      // Save token + user to Zustand store AND localStorage
      storeLogin(data.user, data.access_token)

      // Navigate to the dashboard
      navigate('/myspace')

    } catch (err) {
      // err.response.data.detail = the error message from FastAPI
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)  // always reset loading, even if there was an error
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '15px', background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}>
            <Zap size={26} color="white" fill="white" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F0F0FF' }}>{APP_NAME}</h1>
          <p style={{ color: '#5A5A7A', fontSize: '13px', marginTop: '4px' }}>Weave AI agents into workflows</p>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '20px', padding: '32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#F0F0FF', marginBottom: '24px' }}>
            Sign in to your workspace
          </h2>

          {error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <AlertCircle size={14} color="#EF4444" style={{ marginTop: '1px', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#EF4444' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                  onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
              </div>
            </div>

            <div style={{ marginBottom: '26px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                  onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', border: 'none', borderRadius: '10px', padding: '12px',
              fontSize: '14px', fontWeight: '600', transition: 'all 0.2s',
              background: loading ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
              color:   loading ? '#5A5A7A' : 'white',
              cursor:  loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 24px rgba(124,58,237,0.35)',
            }}>
              {loading ? 'Signing in...' : `Sign in to ${APP_NAME} →`}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#5A5A7A' }}>
            No account?{' '}
            {/* Link is like NavLink but without the active styling */}
            <Link to="/register" style={{ color: '#7C3AED', textDecoration: 'none' }}>
              Create one →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}