import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight, CheckCircle, XCircle, Loader, Clock, ChevronDown, ChevronUp, Zap, Wrench,
  SkipForward, Ban, AlertTriangle, BookOpen, Shield, Brain, Square, Radio,
} from 'lucide-react'
import executionService from '../../services/executionService'

// ── Time helpers ───────────────────────────────────────────────────────────
// The local SQLite fallback returns times without a timezone ("2026-11-10T06:22:19").
// They are UTC, but the browser would read them as local time (IST = +5h30m).
// Adding "Z" marks them as UTC. Supabase times already carry "+00:00".
function parseTime(value) {
  if (!value) return null
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(value)
  return new Date(hasZone ? value : `${value}Z`)
}

function formatDuration(startedAt, finishedAt, now = Date.now()) {
  const start = parseTime(startedAt)
  if (!start) return ''
  const end  = finishedAt ? parseTime(finishedAt) : new Date(now)
  const secs = Math.max(0, Math.floor((end - start) / 1000))
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

const RUNNING = ['pending', 'running', 'cancelling']
const DONE    = ['completed', 'failed', 'skipped', 'cancelled', 'interrupted']

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    pending:     { bg: 'rgba(90,90,122,0.15)',  color: '#8B8BB3', label: 'Pending'     },
    running:     { bg: 'rgba(6,182,212,0.12)',  color: '#06B6D4', label: 'Running'     },
    cancelling:  { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Stopping…'   },
    completed:   { bg: 'rgba(16,185,129,0.12)', color: '#10B981', label: 'Completed'   },
    failed:      { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: 'Failed'      },
    skipped:     { bg: 'rgba(90,90,122,0.10)',  color: '#5A5A7A', label: 'Skipped'     },
    cancelled:   { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Cancelled'   },
    interrupted: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'Interrupted' },
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
  if (status === 'completed')   return <CheckCircle   size={size} color="#10B981" />
  if (status === 'failed')      return <XCircle       size={size} color="#EF4444" />
  if (status === 'skipped')     return <SkipForward   size={size} color="#5A5A7A" />
  if (status === 'cancelled')   return <Ban           size={size} color="#F59E0B" />
  if (status === 'interrupted') return <AlertTriangle size={size} color="#F59E0B" />
  if (status === 'running' || status === 'cancelling')
    return <Loader size={size} color="#06B6D4" style={{ animation: 'spin 1s linear infinite' }} />
  return <Clock size={size} color="#5A5A7A" />
}

// ── One line of live activity (from a streamed event) ─────────────────────
const EVENT_LOOK = {
  run_started:        { icon: Radio,         color: '#7C3AED' },
  node_started:       { icon: Zap,           color: '#8B8BB3' },
  kb_retrieved:       { icon: BookOpen,      color: '#06B6D4' },
  guardrails_applied: { icon: Shield,        color: '#10B981' },
  llm_started:        { icon: Brain,         color: '#A78BFA' },
  llm_fallback:       { icon: AlertTriangle, color: '#F59E0B' },
  tool_started:       { icon: Wrench,        color: '#F59E0B' },
  tool_finished:      { icon: CheckCircle,   color: '#10B981' },
  tool_failed:        { icon: XCircle,       color: '#EF4444' },
  node_completed:     { icon: CheckCircle,   color: '#10B981' },
  node_failed:        { icon: XCircle,       color: '#EF4444' },
  node_blocked:       { icon: Shield,        color: '#EF4444' },
  node_skipped:       { icon: SkipForward,   color: '#5A5A7A' },
  node_cancelled:     { icon: Ban,           color: '#F59E0B' },
  loop_finished:      { icon: CheckCircle,   color: '#EF4444' },
  cancel_requested:   { icon: Square,        color: '#F59E0B' },
  run_completed:      { icon: CheckCircle,   color: '#10B981' },
  run_failed:         { icon: XCircle,       color: '#EF4444' },
  run_cancelled:      { icon: Ban,           color: '#F59E0B' },
}

function EventLine({ ev, startedAt, showAgent = false, live = false }) {
  const look = EVENT_LOOK[ev.type] || { icon: Clock, color: '#5A5A7A' }
  const Icon = live && (ev.type === 'tool_started' || ev.type === 'llm_started') ? Loader : look.icon
  const t0   = parseTime(startedAt)
  const t    = parseTime(ev.created_at)
  const rel  = t0 && t ? `+${Math.max(0, (t - t0) / 1000).toFixed(1)}s` : ''
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '3px 0', fontSize: '12px' }}>
      <span style={{ color: '#3A3A5A', fontFamily: 'monospace', fontSize: '11px', minWidth: '52px', paddingTop: '1px' }}>{rel}</span>
      <Icon size={13} color={look.color} style={{ flexShrink: 0, marginTop: '2px', ...(Icon === Loader ? { animation: 'spin 1s linear infinite' } : {}) }} />
      <span style={{ color: '#C4C4E0', wordBreak: 'break-word' }}>
        {showAgent && ev.agent_name && <span style={{ color: '#8B8BB3', fontWeight: 600 }}>{ev.agent_name} · </span>}
        {ev.message}
      </span>
    </div>
  )
}

// ── Agent log card ─────────────────────────────────────────────────────────
function AgentLogCard({ log, activity, now, runStartedAt }) {
  const [expanded, setExpanded] = useState(false)
  const execTypeColors = {
    sequential: '#7C3AED',
    parallel:   '#06B6D4',
    branch:     '#F59E0B',
    merge:      '#10B981',
    loop:       '#EF4444',
  }
  const typeColor = execTypeColors[log.execution_type] || '#7C3AED'
  const isLive    = log.status === 'running'
  const borderRed = log.status === 'failed'
  // While the agent works, show its latest activity right on the card
  const liveLines = isLive ? activity.filter(e => e.type !== 'node_started').slice(-3) : []

  return (
    <div style={{
      backgroundColor: '#1A1A2E',
      border:          `1px solid ${borderRed ? 'rgba(239,68,68,0.3)' : isLive ? 'rgba(6,182,212,0.35)' : '#2A2A3D'}`,
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
          {/* Duration — ticks every second while running, no network calls */}
          {log.started_at && (
            <div style={{ fontSize: '11px', color: '#5A5A7A', marginTop: '2px' }}>
              {formatDuration(log.started_at, log.finished_at, now)}
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

      {/* Live activity while the agent is working */}
      {liveLines.length > 0 && !expanded && (
        <div style={{ padding: '0 16px 10px 64px' }}>
          {liveLines.map((ev, i) => (
            <EventLine key={ev.id} ev={ev} startedAt={runStartedAt} live={i === liveLines.length - 1} />
          ))}
        </div>
      )}

      {/* Expanded: activity + input + tools + output ───────────────────── */}
      {expanded && (
        <div style={{ borderTop: '1px solid #2A2A3D' }}>

          {/* Activity — every step this agent took */}
          {activity.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A3D' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Activity
              </p>
              {activity.map((ev, i) => (
                <EventLine key={ev.id} ev={ev} startedAt={runStartedAt} live={isLive && i === activity.length - 1} />
              ))}
            </div>
          )}

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
  const [execution,  setExecution]  = useState(null)
  const [events,     setEvents]     = useState([])     // live feed from the stream
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [streamNote, setStreamNote] = useState('')     // shown if live updates fall back to polling
  const [cancelling, setCancelling] = useState(false)
  const [showFeed,   setShowFeed]   = useState(false)
  const [now,        setNow]        = useState(Date.now())
  const refreshTimer = useRef(null)

  const id = parseInt(executionId)

  // Full snapshot (outputs, tool calls). Called on open and whenever an agent finishes.
  const refresh = useCallback(async () => {
    try {
      const data = await executionService.get(id)
      setExecution(data)
      return data
    } catch (err) {
      setError('Could not load execution. It may have been deleted.')
      return null
    } finally {
      setLoading(false)
    }
  }, [id])

  // Several events can arrive together — refresh once, 300 ms after the last one
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(refresh, 300)
  }, [refresh])

  // ── Live stream with reconnect, falling back to slow polling ─────────
  useEffect(() => {
    const controller = new AbortController()
    let lastId   = 0
    let stopped  = false
    let failures = 0

    const handle = (ev) => {
      lastId = ev.id
      setEvents(prev => (prev.some(p => p.id === ev.id) ? prev : [...prev, ev]))
      if (ev.type.startsWith('node_') || ev.type.startsWith('run_') || ev.type === 'cancel_requested') {
        refreshSoon()
      }
    }

    const follow = async () => {
      const first = await refresh()
      if (!first) return
      while (!stopped) {
        try {
          const end = await executionService.stream(id, { after: lastId, onEvent: handle, signal: controller.signal })
          if (end) { await refresh(); return }               // run is over
          failures = 0                                         // dropped: reconnect
        } catch (err) {
          if (controller.signal.aborted) return
          failures += 1
          if (failures >= 3) {
            // Streaming blocked (proxy, network): poll every 3 s instead
            setStreamNote('Live updates unavailable — refreshing every 3 seconds.')
            while (!stopped) {
              const data = await refresh()
              if (!data || !RUNNING.includes(data.status)) return
              await new Promise(r => setTimeout(r, 3000))
            }
            return
          }
        }
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    follow()
    return () => { stopped = true; controller.abort(); clearTimeout(refreshTimer.current) }
  }, [id, refresh, refreshSoon])

  const isRunning = RUNNING.includes(execution?.status)

  // Tick the timers once a second while running (local only — no network)
  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isRunning])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      setExecution(await executionService.cancel(id))
    } catch {
      setCancelling(false)
    }
  }

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

  const status     = execution?.status
  const duration   = formatDuration(execution?.started_at, execution?.finished_at, now)
  // Total = agents in the workflow (from the run_started event), not just the ones started so far.
  // Loop rounds add extra cards, so never show fewer than the cards on screen.
  const planned    = events.find(e => e.type === 'run_started')?.data?.agents || 0
  const totalLogs  = Math.max(execution?.logs?.length || 0, planned)
  const doneLogs   = execution?.logs?.filter(l => DONE.includes(l.status)).length || 0
  const statusText = isRunning ? (status === 'cancelling' ? 'Stopping…' : 'In progress')
                   : status === 'completed' ? 'Finished'
                   : status === 'cancelled' ? 'Cancelled'
                   : status === 'interrupted' ? 'Interrupted' : 'Failed'
  const statusColor = isRunning ? '#06B6D4' : status === 'completed' ? '#10B981'
                    : status === 'failed' ? '#EF4444' : '#F59E0B'

  // Events for one card: same node and same name (loop rounds have their own name)
  const activityFor = (log) => events.filter(e => e.node_id === log.node_id && e.agent_name === log.agent_name)
  const feed        = showFeed ? events : events.slice(-5)

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
        {/* Glow line when running */}
        {isRunning && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #7C3AED, #06B6D4, #7C3AED)',
            backgroundSize: '200% 100%',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <Zap size={18} color="#7C3AED" />
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#F0F0FF' }}>
                {execution?.workflow_name || 'Workflow Execution'}
              </h1>
              <StatusBadge status={status} />
            </div>

            {execution?.user_input && (
              <p style={{ fontSize: '13px', color: '#8B8BB3', marginBottom: '12px', maxWidth: '500px', wordBreak: 'break-word' }}>
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
                {execution?.started_at ? parseTime(execution.started_at).toLocaleTimeString() : '-'}
              </span>
            </div>
          </div>

          {/* Progress + Cancel */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {totalLogs > 0 && (
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: statusColor }}>
                  {Math.round((doneLogs / totalLogs) * 100)}%
                </div>
                <div style={{ fontSize: '11px', color: '#5A5A7A' }}>{statusText}</div>
              </div>
            )}
            {isRunning && (
              <button
                onClick={handleCancel}
                disabled={cancelling || status === 'cancelling'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                  cursor: cancelling || status === 'cancelling' ? 'default' : 'pointer',
                  backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444',
                  opacity: cancelling || status === 'cancelling' ? 0.6 : 1,
                }}
              >
                <Square size={12} /> {status === 'cancelling' ? 'Stopping…' : 'Cancel run'}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalLogs > 0 && (
          <div style={{ marginTop: '16px', height: '4px', backgroundColor: '#2A2A3D', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width:  `${Math.round((doneLogs / totalLogs) * 100)}%`,
              background: status === 'failed' ? '#EF4444' : 'linear-gradient(90deg, #7C3AED, #06B6D4)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}

        {/* Error / stop reason */}
        {execution?.error && (
          <div style={{
            marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
            backgroundColor: status === 'failed' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${status === 'failed' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}>
            <p style={{ fontSize: '13px', color: status === 'failed' ? '#EF4444' : '#F59E0B' }}>
              {status === 'failed' ? '✗' : '■'} {execution.error}
            </p>
          </div>
        )}
      </div>

      {/* ── Live activity feed ──────────────────────────────────────── */}
      {events.length > 0 && (
        <div style={{ backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={13} color={isRunning ? '#06B6D4' : '#5A5A7A'} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#8B8BB3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {isRunning ? 'Live activity' : 'Activity'}
              </span>
              <span style={{ fontSize: '11px', color: '#5A5A7A' }}>{events.length} events</span>
            </div>
            {events.length > 5 && (
              <button onClick={() => setShowFeed(!showFeed)} style={{ background: 'none', border: 'none', color: '#A78BFA', fontSize: '12px', cursor: 'pointer' }}>
                {showFeed ? 'Show latest' : 'Show all'}
              </button>
            )}
          </div>
          {feed.map((ev, i) => (
            <EventLine key={ev.id} ev={ev} startedAt={execution?.started_at} showAgent
              live={isRunning && i === feed.length - 1} />
          ))}
          {streamNote && <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '6px' }}>{streamNote}</p>}
        </div>
      )}

      {/* ── Agent logs ──────────────────────────────────────────────── */}
      {execution?.logs && execution.logs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: '#5A5A7A', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            Agent executions
          </p>
          {execution.logs.map(log => (
            <AgentLogCard key={log.id} log={log} activity={activityFor(log)} now={now}
              runStartedAt={execution.started_at} />
          ))}
        </div>
      ) : isRunning ? (
        <div className="forge-card" style={{ textAlign: 'center', padding: '32px' }}>
          <Loader size={20} color="#7C3AED" style={{ animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
          <p style={{ color: '#5A5A7A', fontSize: '13px' }}>Starting agents...</p>
        </div>
      ) : null}

      {/* ── CSS animation ───────────────────────────────────────────── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
