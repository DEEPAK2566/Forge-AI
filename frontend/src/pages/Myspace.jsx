import { useState, useEffect } from 'react'
import { useNavigate, Link }   from 'react-router-dom'
import { LayoutGrid, Zap, Activity, Globe } from 'lucide-react'
import agentService     from '../services/agentService'
import executionService from '../services/executionService'
import workflowService  from '../services/workflowService'
import toolService      from '../services/toolService'
import api              from '../services/api'
import useAuthStore     from '../store/authStore'
import HowItWorks       from '../components/common/HowItWorks'
import { APP_NAME, APP_TAGLINE } from '../config/brand'

const createItems = [
  { label: 'Agent',          emoji: '🤖', path: '/build/agent'    },
  { label: 'Workflow',       emoji: '🔀', path: '/build/workflow' },
  { label: 'Tool',           emoji: '🔧', path: '/build/tool'     },
  { label: 'Knowledge Base', emoji: '📚', path: '/build/kb'       },
  { label: 'Guardrail',      emoji: '🛡️', path: '/build/guardrail'              },
  
]

function statusColor(status) {
  if (status === 'completed') return '#10B981'
  if (status === 'failed')    return '#EF4444'
  if (status === 'running')   return '#06B6D4'
  if (status === 'cancelled' || status === 'interrupted' || status === 'cancelling') return '#F59E0B'
  return '#5A5A7A'
}

function StatusDot({ status }) {
  const color = statusColor(status)
  return (
    <div style={{
      width: '7px', height: '7px', borderRadius: '50%',
      backgroundColor: color, flexShrink: 0,
      boxShadow: status === 'running' ? `0 0 6px ${color}` : 'none',
    }} />
  )
}

// "2h ago" for the Action Zone (runs only — catalogue cards don't show ages any more)
function ago(value) {
  if (!value) return ''
  const s = Math.max(0, Math.floor((Date.now() - new Date(value)) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(value).toLocaleDateString()
}

export default function MySpace() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const firstName = ((user?.full_name || user?.email || 'Builder').split(/[\s@]/)[0]) || 'Builder'

  const [agentCount,    setAgentCount]    = useState('...')
  const [workflowCount, setWorkflowCount] = useState('...')
  const [toolCount,     setToolCount]     = useState('...')
  const [platform,      setPlatform]      = useState(null)    // everyone's totals
  const [executions,    setExecutions]    = useState([])
  const [loading,       setLoading]       = useState(true)

    useEffect(() => {
    const fetchAll = async () => {
      // allSettled: each call succeeds or fails on its own,
      // so one broken endpoint can't zero out the other two
      const [agents, workflows, execs, tools, stats] = await Promise.allSettled([
        agentService.count(),
        workflowService.count(),
        executionService.community(8),          // everyone's latest runs
        toolService.count(),
        api.get('/discover/stats'),
      ])
      if (tools.status === 'fulfilled') setToolCount(tools.value.count)
      if (stats.status === 'fulfilled') setPlatform(stats.value.data.platform || null)

      if (agents.status === 'fulfilled') setAgentCount(agents.value.count)
      else { console.error('agents/count failed:', agents.reason); setAgentCount('!') }

      if (workflows.status === 'fulfilled') setWorkflowCount(workflows.value.count)
      else { console.error('workflows/count failed:', workflows.reason); setWorkflowCount('!') }

      if (execs.status === 'fulfilled') setExecutions(execs.value)
      else console.error('executions list failed:', execs.reason)

      setLoading(false)
    }
    fetchAll()
  }, [])

  const stats = [
    { label: 'Agents',    value: loading ? '...' : agentCount,    color: '#7C3AED' },
    { label: 'Workflows', value: loading ? '...' : workflowCount, color: '#06B6D4' },
    { label: 'Tools',     value: loading ? '...' : toolCount,     color: '#F59E0B' },
  ]

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning'
                 : hour < 17 ? 'Good afternoon'
                 : 'Good evening'

  return (
    <div className="page-wrapper">

      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #13131F 100%)',
        border: '1px solid #2A2A3D', borderRadius: '20px',
        padding: 'var(--banner-padding)', marginBottom: '16px',
        position: 'relative', overflow: 'hidden', width: '100%',
      }}>
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '220px', height: '220px',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <h1 style={{ fontSize: 'var(--font-h1)', fontWeight: '700', color: '#F0F0FF', marginBottom: '6px' }}>
          {greeting}, {firstName}! ⚡
        </h1>
        <p style={{ color: '#8B8BB3', fontSize: '14px', marginBottom: '24px' }}>
          Welcome to {APP_NAME}. {APP_TAGLINE}
        </p>
        <div style={{ fontSize: '11px', color: '#5A5A7A', marginBottom: '6px', letterSpacing: '0.5px' }}>YOUR WORK</div>
        <div className="stats-row">
          {stats.map(s => (
            <div key={s.label} className="stat-item">
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Platform highlight: what EVERYONE has built */}
        {platform && (
          <div style={{
            marginTop: '18px', padding: '14px 16px', borderRadius: '14px',
            background: 'linear-gradient(90deg, rgba(124,58,237,0.16), rgba(6,182,212,0.10))',
            border: '1px solid rgba(124,58,237,0.35)',
            display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F0F0FF', fontSize: '13px', fontWeight: 600 }}>
              <Globe size={16} color="#A78BFA" /> Built on {APP_NAME} so far
            </span>
            {[
              ['agents', 'agents built', '#A78BFA'], ['workflows', 'workflows', '#22D3EE'], ['tools', 'tools', '#FBBF24'],
              ['runs', 'runs', '#34D399'], ['builders', 'builders', '#F472B6'],
            ].map(([key, label, color]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <b style={{ fontSize: '20px', color }}>{platform[key]}</b>
                <span style={{ fontSize: '12px', color: '#8B8BB3' }}>{label}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Creation Zone */}
      <div className="forge-card">
        <div className="forge-section-header">
          <LayoutGrid size={15} color="#7C3AED" />
          <span className="forge-section-title">Creation Zone</span>
        </div>
        <div className="creation-grid">
          {createItems.map(item => (
            <div
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              style={{
                backgroundColor: '#1A1A2E', borderRadius: '14px', padding: '18px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                cursor: item.path ? 'pointer' : 'default',
                border: `1px dashed ${item.path ? '#2A2A3D' : '#1A1A2E'}`,
                opacity: item.path ? 1 : 0.5, transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!item.path) return
                e.currentTarget.style.borderColor = '#7C3AED'
                e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.08)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = item.path ? '#2A2A3D' : '#1A1A2E'
                e.currentTarget.style.backgroundColor = '#1A1A2E'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {item.emoji}
              </div>
              <span style={{ fontSize: '12px', color: '#8B8BB3', fontWeight: '500', textAlign: 'center' }}>
                {item.label}
              </span>
              {!item.path && <span style={{ fontSize: '9px', color: '#5A5A7A' }}>Coming soon</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Action Zone */}
      <div className="forge-card" style={{ marginBottom: 0 }}>
        <div className="forge-section-header">
          <Zap size={15} color="#F59E0B" />
          <span className="forge-section-title">Action Zone</span>
          {executions.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#5A5A7A' }}>
              Latest runs by everyone · <Link to="/executions" style={{ color: '#A78BFA', textDecoration: 'none' }}>View all runs →</Link>
            </span>
          )}
        </div>

        {executions.length === 0 ? (
          <div style={{ backgroundColor: '#1A1A2E', borderRadius: '12px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#2A2A3D" />
            <p style={{ color: '#5A5A7A', fontSize: '13px', textAlign: 'center' }}>
              No runs yet. Run a workflow and it shows up here for everyone
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {executions.map(exec => {
              const row = (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D',
                  transition: 'all 0.15s', cursor: exec.is_mine ? 'pointer' : 'default',
                }}
                  title={exec.is_mine ? 'Open this run' : `Run by ${exec.run_by}: only they can open the details`}
                  onMouseEnter={e => { if (exec.is_mine) { e.currentTarget.style.borderColor = '#2A2A4D'; e.currentTarget.style.backgroundColor = '#1E1E38' } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A3D'; e.currentTarget.style.backgroundColor = '#1A1A2E' }}
                >
                  <StatusDot status={exec.status} />
                  <span style={{ flex: 1, fontSize: '13px', color: '#F0F0FF', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exec.workflow_name || `Run #${exec.id}`}
                  </span>
                  <span style={{ fontSize: '11px', color: statusColor(exec.status), fontWeight: '500', flexShrink: 0 }}>
                    {exec.status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#5A5A7A', flexShrink: 0, minWidth: '56px', textAlign: 'right' }}>
                    {ago(exec.started_at)}
                  </span>
                  {/* who ran it */}
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                    fontSize: '12px', color: exec.is_mine ? '#A78BFA' : '#C4C4E0', minWidth: '84px', justifyContent: 'flex-end',
                  }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', fontSize: '10px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                      background: exec.is_mine ? 'linear-gradient(135deg, #7C3AED, #8B5CF6)' : 'linear-gradient(135deg, #0891B2, #06B6D4)',
                    }}>{(exec.run_by || '?')[0].toUpperCase()}</span>
                    {exec.run_by}
                  </span>
                </div>
              )
              return exec.is_mine
                ? <Link key={exec.id} to={`/executions/${exec.id}`} style={{ textDecoration: 'none' }}>{row}</Link>
                : <div key={exec.id}>{row}</div>
            })}
          </div>
        )}
      </div>

      {/* For first-time visitors: what is a tool / agent / workflow? */}
      <div style={{ marginTop: '16px' }}>
        <HowItWorks />
      </div>
    </div>
  )
}