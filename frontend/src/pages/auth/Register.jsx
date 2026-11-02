import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Mail, Lock, User, AlertCircle } from 'lucide-react'
import authService from '../../services/authService'
import useAuthStore from '../../store/authStore'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const navigate    = useNavigate()
  const storeLogin  = useAuthStore((state) => state.login)

  const inputStyle = {
    width: '100%', backgroundColor: '#1A1A2E',
    border: '1px solid #2A2A3D', borderRadius: '10px',
    padding: '11px 14px 11px 40px', color: '#F0F0FF', fontSize: '14px',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validation before sending to server
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const data = await authService.register(email, password, fullName)
      storeLogin(data.user, data.access_token)
      navigate('/myspace')
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. It may be waking up (wait 30–60s and retry) or blocked by CORS.')
      } else if (err.response.status >= 500) {
        setError('Server error while creating your account. Please try again shortly.')
      } else {
        setError(err.response.data?.detail || `Registration failed (code ${err.response.status}).`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '15px', background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}>
            <Zap size={26} color="white" fill="white" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F0F0FF' }}>FORGE</h1>
          <p style={{ color: '#5A5A7A', fontSize: '13px', marginTop: '4px' }}>Create your workspace</p>
        </div>

        <div style={{ backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '20px', padding: '32px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#F0F0FF', marginBottom: '24px' }}>
            Create your account
          </h2>

          {error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <AlertCircle size={14} color="#EF4444" style={{ marginTop: '1px', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#EF4444' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full name */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Full name</label>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                  onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                  onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#7C3AED'}
                  onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
              </div>
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: '26px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#8B8BB3', marginBottom: '6px' }}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#5A5A7A" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your password" required style={inputStyle}
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
              {loading ? 'Creating account...' : 'Create account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#5A5A7A' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#7C3AED', textDecoration: 'none' }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}