import { useState, useEffect } from 'react'
import { useNavigate, Link }   from 'react-router-dom'
import { LayoutGrid, Zap, Activity, CheckCircle, XCircle, Loader } from 'lucide-react'
import agentService     from '../services/agentService'
import executionService from '../services/executionService'
import workflowService  from '../services/workflowService'

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

export default function MySpace() {
  const navigate = useNavigate()

  const [agentCount,    setAgentCount]    = useState('...')
  const [workflowCount, setWorkflowCount] = useState('...')
  const [executions,    setExecutions]    = useState([])
  const [loading,       setLoading]       = useState(true)

    useEffect(() => {
    const fetchAll = async () => {
      // allSettled: each call succeeds or fails on its own,
      // so one broken endpoint can't zero out the other two
      const [agents, workflows, execs] = await Promise.allSettled([
        agentService.count(),
        workflowService.count(),
        executionService.list(5),
      ])

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
    { label: 'Revisions', value: '0',                              color: '#F59E0B' },
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
          {greeting}, Builder! ⚡
        </h1>
        <p style={{ color: '#8B8BB3', fontSize: '14px', marginBottom: '24px' }}>
          Your FORGE platform is ready. Let's build something powerful.
        </p>
        <div className="stats-row">
          {stats.map(s => (
            <div key={s.label} className="stat-item">
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px' }}>
          <a
            href="/discover"
            style={{
              fontSize: '12px',
              color: '#7C3AED',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
          </a>
        </div>
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
              Recent executions
            </span>
          )}
        </div>

        {executions.length === 0 ? (
          <div style={{ backgroundColor: '#1A1A2E', borderRadius: '12px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#2A2A3D" />
            <p style={{ color: '#5A5A7A', fontSize: '13px', textAlign: 'center' }}>
              No executions yet — run a workflow to see activity here
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {executions.map(exec => (
              <Link
                key={exec.id}
                to={`/executions/${exec.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D',
                  transition: 'all 0.15s', cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A2A4D'; e.currentTarget.style.backgroundColor = '#1E1E38' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A3D'; e.currentTarget.style.backgroundColor = '#1A1A2E' }}
                >
                  <StatusDot status={exec.status} />
                  <span style={{ flex: 1, fontSize: '13px', color: '#F0F0FF', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exec.workflow_name || `Execution #${exec.id}`}
                  </span>
                  <span style={{ fontSize: '11px', color: statusColor(exec.status), fontWeight: '500', flexShrink: 0 }}>
                    {exec.status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#5A5A7A', flexShrink: 0 }}>
                    {exec.started_at ? new Date(exec.started_at).toLocaleTimeString() : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}