import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronRight, History, Loader, RefreshCw } from 'lucide-react'
import executionService from '../../services/executionService'
import RerunButton from '../../components/common/RerunButton'

// ── Helpers ────────────────────────────────────────────────────────────────
// Local SQLite returns times without a timezone; they are UTC (see ExecutionMonitor)
function parseTime(value) {
  if (!value) return null
  return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

function formatDuration(startedAt, finishedAt) {
  const start = parseTime(startedAt)
  if (!start) return '—'
  const end  = finishedAt ? parseTime(finishedAt) : new Date()
  const secs = Math.max(0, Math.floor((end - start) / 1000))
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function timeAgo(value) {
  const t = parseTime(value)
  if (!t) return '—'
  const secs = Math.floor((Date.now() - t) / 1000)
  if (secs < 60)    return 'just now'
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return t.toLocaleDateString()
}

const STATUS = {
  pending:     { color: '#8B8BB3', label: 'Pending'     },
  running:     { color: '#06B6D4', label: 'Running'     },
  cancelling:  { color: '#F59E0B', label: 'Stopping…'   },
  completed:   { color: '#10B981', label: 'Completed'   },
  failed:      { color: '#EF4444', label: 'Failed'      },
  cancelled:   { color: '#F59E0B', label: 'Cancelled'   },
  interrupted: { color: '#F59E0B', label: 'Interrupted' },
}

const FILTERS = [
  { key: '',                                label: 'All'       },
  { key: 'pending,running,cancelling',      label: 'Running'   },
  { key: 'completed',                       label: 'Completed' },
  { key: 'failed',                          label: 'Failed'    },
  { key: 'cancelled,interrupted',           label: 'Stopped'   },
]

const PAGE = 25

// ── Runs page ──────────────────────────────────────────────────────────────
export default function ExecutionHistory() {
  const navigate = useNavigate()
  const [filter,  setFilter]  = useState('')
  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async (offset = 0) => {
    setLoading(true)
    setError('')
    try {
      const page = await executionService.history({ limit: PAGE, offset, status: filter })
      setItems(prev => (offset === 0 ? page.items : [...prev, ...page.items]))
      setTotal(page.total)
    } catch {
      setError('Could not load runs.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="page-wrapper">

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A5A7A', marginBottom: '20px' }}>
        <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>FORGE</Link>
        <ChevronRight size={13} />
        <span style={{ color: '#F0F0FF' }}>Runs</span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <History size={20} color="#7C3AED" />
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#F0F0FF' }}>Runs</h1>
        <span style={{ fontSize: '13px', color: '#5A5A7A' }}>{total} total</span>
        <button onClick={() => load(0)} title="Refresh" style={{ marginLeft: 'auto', background: 'none', border: '1px solid #2A2A3D', borderRadius: '8px', padding: '6px 10px', color: '#8B8BB3', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <p style={{ fontSize: '13px', color: '#8B8BB3', marginBottom: '18px' }}>
        Every workflow run, newest first. Open one to see what each agent did, or re-run it with the same inputs.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button key={f.label} onClick={() => setFilter(f.key)} style={{
              padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
              backgroundColor: active ? 'rgba(124,58,237,0.15)' : 'transparent',
              border: `1px solid ${active ? 'rgba(124,58,237,0.5)' : '#2A2A3D'}`,
              color: active ? '#F0F0FF' : '#8B8BB3',
            }}>
              {f.label}
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

      {/* List */}
      {items.length === 0 && !loading ? (
        <div style={{ backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#5A5A7A', fontSize: '13px' }}>
            {filter ? 'No runs match this filter.' : 'No runs yet — run a workflow from the builder or Discover.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(run => {
            const s = STATUS[run.status] || STATUS.pending
            const finished = !['pending', 'running', 'cancelling'].includes(run.status)
            return (
              <div
                key={run.id}
                onClick={() => navigate(`/executions/${run.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                  backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', borderRadius: '12px',
                  padding: '12px 16px', cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A3D' }}
              >
                {/* Status dot */}
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: s.color, flexShrink: 0,
                  boxShadow: finished ? 'none' : `0 0 6px ${s.color}` }} />

                {/* Workflow + id + error */}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#F0F0FF' }}>{run.workflow_name || 'Workflow'}</span>
                    <span style={{ fontSize: '11px', color: '#5A5A7A' }}>#{run.id}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: s.color }}>{s.label}</span>
                  </div>
                  {run.error && (
                    <div style={{ fontSize: '12px', color: run.status === 'failed' ? '#EF4444' : '#F59E0B', marginTop: '3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '640px' }}>
                      {run.error}
                    </div>
                  )}
                </div>

                {/* Facts */}
                <div style={{ display: 'flex', gap: '18px', fontSize: '12px', color: '#8B8BB3', flexWrap: 'wrap' }}>
                  <span title={parseTime(run.started_at)?.toLocaleString()}>{timeAgo(run.started_at)}</span>
                  <span>{formatDuration(run.started_at, run.finished_at)}</span>
                  <span>{run.agents} agent{run.agents === 1 ? '' : 's'}</span>
                </div>

                {/* Re-run (finished runs only) */}
                <div onClick={e => e.stopPropagation()} style={{ minWidth: '84px', display: 'flex', justifyContent: 'flex-end' }}>
                  {finished && <RerunButton execution={run} compact />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more / loading */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        {loading ? (
          <Loader size={18} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />
        ) : items.length < total ? (
          <button onClick={() => load(items.length)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', color: '#F0F0FF' }}>
            Load more ({total - items.length} more)
          </button>
        ) : null}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
