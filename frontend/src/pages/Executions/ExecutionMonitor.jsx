import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, XCircle, Loader, Clock, ChevronDown, ChevronUp, Zap, Wrench, SkipForward } from 'lucide-react'
import executionService from '../../services/executionService'

// ── Duration formatter ─────────────────────────────────────────────────────
function formatDuration(startedAt, finishedAt) {
  if (!startedAt) return ''
  const start = new Date(startedAt)
  const end   = finishedAt ? new Date(finishedAt) : new Date()
  const secs  = Math.floor((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {

    pending:   { bg: 'rgba(90,90,122,0.15)',  color: '#8B8BB3',  label: 'Pending'   },
    running:   { bg: 'rgba(6,182,212,0.12)',  color: '#06B6D4',  label: 'Running'   },
    completed: { bg: 'rgba(16,185,129,0.12)', color: '#10B981',  label: 'Completed' },
    failed:    { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444',  label: 'Failed'    },
    skipped:   { bg: 'rgba(90,90,122,0.10)',  color: '#5A5A7A',  label: 'Skipped'   },
  }
  const s = styles[status] || styles.pending
  return (
    <span style={{
      fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px',
      backgroundColor: s.bg, color: s.color, letterSpacing: '0.03em',
    }}>
      {s.label}
    </span>
  )
}

// ── Status icon ────────────────────────────────────────────────────────────
function StatusIcon({ status, size = 16 }) {
  if (status === 'completed') return <CheckCircle size={size} color="#10B981" />
  if (status === 'failed')    return <XCircle     size={size} color="#EF4444" />
  if (status === 'skipped')   return <SkipForward size={size} color="#5A5A7A" />

  if (status === 'running')   return <Loader      size={size} color="#06B6D4" style={{ animation: 'spin 1s linear infinite' }} />
  return <Clock size={size} color="#5A5A7A" />
}

// ── Agent log card ─────────────────────────────────────────────────────────
function AgentLogCard({ log }) {
  const [expanded, setExpanded] = useState(false)
  const execTypeColors = {
    sequential: '#7C3AED',
    parallel:   '#06B6D4',
    branch:     '#F59E0B',
    merge:      '#10B981',
    loop:       '#EF4444',
  }
  const typeColor = execTypeColors[log.execution_type] || '#7C3AED'

  return (
    <div style={{
      backgroundColor: '#1A1A2E',
      border:          `1px solid ${log.status === 'failed' ? 'rgba(239,68,68,0.3)' : '#2A2A3D'}`,
      borderRadius:    '12px',
      overflow:        'hidden',
      transition:      'border-color 0.2s',
    }}>
      {/* Header row */}
      <div
        onClick={() => log.status !== 'pending' && setExpanded(!expanded)}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '12px',
          padding:    '12px 16px',
          cursor:     log.status !== 'pending' ? 'pointer' : 'default',
        }}
      >
        {/* Agent avatar */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
          background: `${typeColor}18`, border: `1px solid ${typeColor}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
        }}>
          {log.agent_emoji || '🤖'}
        </div>

        {/* Agent name + execution type */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#F0F0FF' }}>
              {log.agent_name}
            </span>
            <span style={{
              fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px',
              textTransform: 'uppercase', padding: '2px 6px', borderRadius: '3px',
              background: `${typeColor}18`, color: typeColor,
            }}>
              {log.execution_type || 'sequential'}
            </span>
          </div>
          {/* Duration */}
          {log.started_at && (
            <div style={{ fontSize: '11px', color: '#5A5A7A', marginTop: '2px' }}>
              {formatDuration(log.started_at, log.finished_at)}
            </div>
          )}
        </div>

        {/* Status + expand toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <StatusBadge status={log.status} />
          <StatusIcon  status={log.status} size={15} />
          {log.status !== 'pending' && (
            expanded
              ? <ChevronUp   size={14} color="#5A5A7A" />
              : <ChevronDown size={14} color="#5A5A7A" />
          )}
        </div>
      </div>

      {/* Expanded: input + output ─────────────────────────────────────── */}
      {expanded && (
        <div style={{ borderTop: '1px solid #2A2A3D' }}>

          {/* Input */}
          {log.input && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A3D' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#5A5A7A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Input
              </p>
              <pre style={{
                fontSize: '12px', color: '#8B8BB3', lineHeight: '1.6',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: '160px', overflowY: 'auto',
                backgroundColor: '#0D0D14', padding: '10px', borderRadius: '6px',
              }}>
                {log.input}
              </pre>
            </div>
          )}
          {/* Tool calls — what the LLM actually called, with which args */}
          {log.tool_calls && log.tool_calls.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A3D' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Tool calls ({log.tool_calls.length})
              </p>
              {log.tool_calls.map((call, i) => (
                <div key={i} style={{ marginBottom: '8px', backgroundColor: '#0D0D14', borderRadius: '6px', padding: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Wrench size={12} color="#F59E0B" />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#F0F0FF' }}>
                      {i + 1}. {call.tool}
                    </span>
                  </div>
                  {Object.keys(call.args || {}).length > 0 && (
                    <pre style={{ fontSize: '11px', color: '#8B8BB3', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 6px' }}>
                      {Object.entries(call.args).map(([k, v]) => `${k}: ${v}`).join('\n')}
                    </pre>
                  )}
                  <pre style={{ fontSize: '11px', color: '#10B981', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '140px', overflowY: 'auto', margin: 0 }}>
                    {call.result}
                  </pre>
                </div>
              ))}
            </div>
          )}


          {/* Output */}
          {log.output && (
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Output
              </p>
              <pre style={{
                fontSize: '12px', color: '#F0F0FF', lineHeight: '1.6',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: '240px', overflowY: 'auto',
                backgroundColor: '#0D0D14', padding: '10px', borderRadius: '6px',
              }}>
                {log.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {log.error && (
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Error
              </p>
              <pre style={{
                fontSize: '12px', color: '#EF4444', lineHeight: '1.5',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                backgroundColor: 'rgba(239,68,68,0.06)', padding: '10px', borderRadius: '6px',
              }}>
                {log.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ExecutionMonitor page ─────────────────────────────────────────────
export default function ExecutionMonitor() {
  const { executionId }  = useParams()
  const navigate         = useNavigate()
  const [execution, setExecution] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const pollingRef = useRef(null)  // stores the interval ID so we can clear it

  // ── Polling function ──────────────────────────────────────────────────
  const fetchExecution = async () => {
    try {
      const data = await executionService.get(parseInt(executionId))
      setExecution(data)

      // Stop polling when execution finishes
      if (data.status === 'completed' || data.status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    } catch (err) {
      setError('Could not load execution. It may have been deleted.')
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Start polling on mount ────────────────────────────────────────────
  useEffect(() => {
    fetchExecution()  // immediate first load

    // Poll every 2 seconds
    pollingRef.current = setInterval(fetchExecution, 2000)

    // Cleanup: stop polling when component unmounts
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [executionId])

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0D0D14' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={24} color="#7C3AED" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <p style={{ color: '#5A5A7A', fontSize: '14px' }}>Loading execution...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-wrapper" style={{ paddingTop: '40px' }}>
        <p style={{ color: '#EF4444', fontSize: '14px' }}>{error}</p>
        <button onClick={() => navigate('/myspace')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', color: '#F0F0FF', cursor: 'pointer', fontSize: '13px' }}>
          Back to My Space
        </button>
      </div>
    )
  }

  const isRunning  = execution?.status === 'running' || execution?.status === 'pending'
  const duration   = formatDuration(execution?.started_at, execution?.finished_at)
  const totalLogs  = execution?.logs?.length || 0
  const doneLogs   = execution?.logs?.filter(l => ['completed', 'failed', 'skipped'].includes(l.status)).length || 0
  return (
    <div className="page-wrapper">

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A5A7A', marginBottom: '20px' }}>
        <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>FORGE</Link>
        <ChevronRight size={13} />
        <span>Executions</span>
        <ChevronRight size={13} />
        <span style={{ color: '#F0F0FF' }}>#{execution?.id}</span>
      </div>

      {/* ── Execution header ────────────────────────────────────────── */}
      <div style={{
        background:    'linear-gradient(135deg, #1A1A2E 0%, #13131F 100%)',
        border:        '1px solid #2A2A3D',
        borderRadius:  '20px',
        padding:       '24px 28px',
        marginBottom:  '16px',
        position:      'relative',
        overflow:      'hidden',
      }}>
        {/* Animated glow when running */}
        {isRunning && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #7C3AED, #06B6D4, #7C3AED)',
            backgroundSize: '200% 100%',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Zap size={18} color="#7C3AED" />
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#F0F0FF' }}>
                {execution?.workflow_name || 'Workflow Execution'}
              </h1>
              <StatusBadge status={execution?.status} />
            </div>

            {execution?.user_input && (
              <p style={{ fontSize: '13px', color: '#8B8BB3', marginBottom: '12px', maxWidth: '500px' }}>
                Input: <span style={{ color: '#F0F0FF' }}>{execution.user_input.slice(0, 100)}{execution.user_input.length > 100 ? '...' : ''}</span>
              </p>
            )}

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
                <span style={{ color: '#8B8BB3' }}>Agents: </span>
                {doneLogs}/{totalLogs}
              </span>
              {duration && (
                <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
                  <span style={{ color: '#8B8BB3' }}>Duration: </span>
                  {duration}
                </span>
              )}
              <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
                <span style={{ color: '#8B8BB3' }}>Started: </span>
                {execution?.started_at ? new Date(execution.started_at).toLocaleTimeString() : '-'}
              </span>
            </div>
          </div>

          {/* Progress indicator */}
          {totalLogs > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: isRunning ? '#06B6D4' : execution?.status === 'completed' ? '#10B981' : '#EF4444' }}>
                {totalLogs > 0 ? Math.round((doneLogs / totalLogs) * 100) : 0}%
              </div>
              <div style={{ fontSize: '11px', color: '#5A5A7A' }}>
                {isRunning ? 'In progress' : execution?.status === 'completed' ? 'Finished' : 'Failed'}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalLogs > 0 && (
          <div style={{ marginTop: '16px', height: '4px', backgroundColor: '#2A2A3D', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width:  `${Math.round((doneLogs / totalLogs) * 100)}%`,
              background: execution?.status === 'failed' ? '#EF4444' : 'linear-gradient(90deg, #7C3AED, #06B6D4)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}

        {/* Error message */}
        {execution?.error && (
          <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
            <p style={{ fontSize: '13px', color: '#EF4444' }}>
              ✗ {execution.error}
            </p>
          </div>
        )}
      </div>

      {/* ── Agent logs ──────────────────────────────────────────────── */}
      {execution?.logs && execution.logs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: '#5A5A7A', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Agent executions
          </p>
          {execution.logs.map(log => (
            <AgentLogCard key={log.id} log={log} />
          ))}
        </div>
      ) : isRunning ? (
        <div className="forge-card" style={{ textAlign: 'center', padding: '32px' }}>
          <Loader size={20} color="#7C3AED" style={{ animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
          <p style={{ color: '#5A5A7A', fontSize: '13px' }}>Starting agents...</p>
        </div>
      ) : null}

      {/* ── Add CSS animation ───────────────────────────────────────── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}