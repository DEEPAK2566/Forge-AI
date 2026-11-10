import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { Search, Play, Trash2, Edit2 } from 'lucide-react'
import api from '../services/api'
import RunWorkflowModal from '../components/common/RunWorkflowModal'
import executionService from '../services/executionService'

const TABS = [
  { id: 'agents',          label: 'Agents',         emoji: '🤖', endpoint: '/discover/agents'          },
  { id: 'workflows',       label: 'Workflows',       emoji: '🔀', endpoint: '/discover/workflows'       },
  { id: 'tools',           label: 'Tools',           emoji: '🔧', endpoint: '/discover/tools'           },
  { id: 'knowledge_bases', label: 'Knowledge Bases', emoji: '📚', endpoint: '/discover/knowledge-bases' },
]

// Delete endpoint map per type
const DELETE_ENDPOINTS = {
  agents:          (id) => `/agents/${id}`,
  workflows:       (id) => `/workflows/${id}`,
  tools:           (id) => `/tools/${id}`,
  knowledge_bases: (id) => `/knowledge-bases/${id}`,
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Delete confirmation modal ──────────────────────────────────────────────
function DeleteModal({ item, type, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
      }}
    >
      <div style={{
        backgroundColor: '#13131F', border: '1px solid #2A2A3D',
        borderRadius: '20px', width: '100%', maxWidth: '400px', padding: '28px',
      }}>
        {/* Warning icon */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '22px',
        }}>
          🗑️
        </div>

        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#F0F0FF', textAlign: 'center', marginBottom: '8px' }}>
          Delete {type.slice(0, -1)}?
        </h2>
        <p style={{ fontSize: '13px', color: '#8B8BB3', textAlign: 'center', marginBottom: '6px', lineHeight: '1.5' }}>
          You are about to permanently delete:
        </p>
        <p style={{
          fontSize: '14px', fontWeight: '600', color: '#EF4444',
          textAlign: 'center', marginBottom: '20px',
          padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          {item.name}
        </p>
        <p style={{ fontSize: '12px', color: '#5A5A7A', textAlign: 'center', marginBottom: '24px' }}>
          This action cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              backgroundColor: 'transparent', border: '1px solid #2A2A3D',
              color: '#8B8BB3', fontSize: '14px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              backgroundColor: deleting ? '#2A2A3D' : 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: deleting ? '#5A5A7A' : '#EF4444',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Artifact card ──────────────────────────────────────────────────────────
function ArtifactCard({ item, type, onRun, onEdit, onDelete }) {
  const [hovered,    setHovered]    = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const avatar = item.avatar_emoji || (
    type === 'agents'    ? '🤖' :
    type === 'workflows' ? '🔀' :
    type === 'tools'     ? '🔧' : '📚'
  )

  const tags = [
    ...(item.good_at || []).slice(0, 3),
    item.practice_area,
  ].filter(Boolean)

  const isClickable = type === 'agents' || type === 'tools'

  return (
    <>
      {showDelete && (
        <DeleteModal
          item={item}
          type={type}
          onCancel={() => setShowDelete(false)}
          onConfirm={async () => {
            await onDelete(item)
            setShowDelete(false)
          }}
        />
      )}

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: '#13131F',
          border:          `1px solid ${hovered ? '#3A3A5D' : '#2A2A3D'}`,
          borderRadius:    '16px',
          padding:         '18px 20px',
          transition:      'all 0.18s',
          display:         'flex', flexDirection: 'column', gap: '12px',
          transform:       hovered ? 'translateY(-2px)' : 'none',
          boxShadow:       hovered ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
          position:        'relative',
        }}
      >
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '14px', fontWeight: '600', color: '#F0F0FF',
              marginBottom: '3px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name}
            </div>
            <div style={{
              fontSize: '12px', color: '#8B8BB3', lineHeight: '1.5',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.description || item.details || item.role || 'No description'}
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {tags.map(tag => (
              <span key={tag} style={{
                fontSize: '10px', fontWeight: '500',
                padding: '2px 7px', borderRadius: '4px',
                backgroundColor: 'rgba(124,58,237,0.1)',
                color: '#8B5CF6', border: '1px solid rgba(124,58,237,0.2)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #2A2A3D', paddingTop: '10px',
        }}>
          <span style={{ fontSize: '11px', color: '#5A5A7A' }}>
            {timeAgo(item.created_at)}
          </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>

            {/* Edit button — agents and tools only */}
            {isClickable && (
              <button
                onClick={() => onEdit(item)}
                title="Edit"
                style={{
                  padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  color: '#7C3AED', fontSize: '11px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Edit2 size={10} /> Edit
              </button>
            )}

            {/* Run button — workflows only */}
            {type === 'workflows' && (
              <button
                onClick={() => onRun(item)}
                title="Run this workflow"
                style={{
                  padding: '5px 10px', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10B981', fontSize: '11px', fontWeight: '500',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Play size={10} fill="#10B981" /> Run
              </button>
            )}

            {/* Published badge */}
            <span style={{
              padding: '4px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '500',
              backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981',
              border: '1px solid rgba(16,185,129,0.25)',
            }}>
              Published
            </span>

            {/* Delete button */}
            <button
              onClick={() => setShowDelete(true)}
              title="Delete"
              style={{
                padding: '5px 7px', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={12} />
            </button>

          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Discover page ─────────────────────────────────────────────────────
export default function Discover() {
  const navigate = useNavigate()

  const [activeTab,       setActiveTab]       = useState('agents')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [search,          setSearch]          = useState('')
  const [items,           setItems]           = useState([])
  const [stats,           setStats]           = useState({})
  const [loading,         setLoading]         = useState(true)

  // Fetch platform stats once
  useEffect(() => {
    api.get('/discover/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(debouncedSearch), 400)
    return () => clearTimeout(t)
  }, [debouncedSearch])

  // Fetch items when tab or search changes
  useEffect(() => {
    const tab = TABS.find(t => t.id === activeTab)
    if (!tab) return
    setLoading(true)
    setItems([])
    const params = search.trim() ? `?search=${encodeURIComponent(search)}` : ''
    api.get(`${tab.endpoint}${params}`)
      .then(r  => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [activeTab, search])

  // Re-fetch stats after a delete
  const refreshStats = () => {
    api.get('/discover/stats').then(r => setStats(r.data)).catch(() => {})
  }

  // Delete handler
  const handleDelete = async (item) => {
    const endpoint = DELETE_ENDPOINTS[activeTab]
    if (!endpoint) return
    try {
      await api.delete(endpoint(item.id))
      // Remove from local list immediately — no need to re-fetch
      setItems(prev => prev.filter(i => i.id !== item.id))
      refreshStats()
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed. Please try again.')
    }
  }

  // Edit handler
  const handleEdit = (item) => {
    if (activeTab === 'agents') navigate(`/build/agent/${item.id}`)
    if (activeTab === 'tools')  navigate(`/build/tool/${item.id}`)
  }

  // Run workflow handler
  // Opens the Run window, which asks for every {{ variable }} the agents use
  const [runTarget, setRunTarget] = useState(null)
  const handleRun = (workflow) => setRunTarget(workflow)

  const startRun = async (input) => {
    const workflow = runTarget
    setRunTarget(null)
    try {
      const execution = await executionService.run(workflow.id, input)
      navigate(`/executions/${execution.id}`)
    } catch (err) {
      alert(err.response?.status === 404
        ? 'Could not start execution. You can only run your own workflows.'
        : 'Could not start execution. Please try again.')
    }
  }

  return (
    <div className="page-wrapper">

      {/* Run window — same {{ variable }} form as the workflow builder */}
      {runTarget && (
        <RunWorkflowModal
          nodes={runTarget.nodes || []}
          workflowName={runTarget.name}
          onCancel={() => setRunTarget(null)}
          onConfirm={startRun}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F0FF', marginBottom: '3px' }}>Discover</h1>
          <p style={{ fontSize: '13px', color: '#8B8BB3' }}>Browse, run, edit, or delete your published artifacts</p>
        </div>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="#5A5A7A" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text" value={debouncedSearch}
            onChange={e => setDebouncedSearch(e.target.value)}
            placeholder="Search by name..."
            style={{ width: '100%', backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', borderRadius: '10px', padding: '9px 12px 9px 36px', color: '#F0F0FF', fontSize: '13px' }}
            onFocus={e => e.target.style.borderColor = '#7C3AED'}
            onBlur={e  => e.target.style.borderColor = '#2A2A3D'}
          />
        </div>
      </div>

      {/* Stats strip */}
      {Object.keys(stats).length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: '10px', cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? 'rgba(124,58,237,0.12)' : '#1A1A2E',
                border: `1px solid ${activeTab === tab.id ? 'rgba(124,58,237,0.35)' : '#2A2A3D'}`,
                display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '16px' }}>{tab.emoji}</span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: activeTab === tab.id ? '#7C3AED' : '#F0F0FF' }}>
                {stats[tab.id] || 0}
              </span>
              <span style={{ fontSize: '12px', color: '#5A5A7A' }}>{tab.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid #2A2A3D', marginBottom: '20px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 16px', cursor: 'pointer',
              backgroundColor: 'transparent', border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? '#7C3AED' : 'transparent'}`,
              color: activeTab === tab.id ? '#F0F0FF' : '#5A5A7A',
              fontSize: '13px', fontWeight: activeTab === tab.id ? '500' : '400',
              transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#5A5A7A', fontSize: '14px' }}>
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          backgroundColor: '#13131F', borderRadius: '16px', border: '1px solid #2A2A3D',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>
            {TABS.find(t => t.id === activeTab)?.emoji}
          </div>
          <p style={{ color: '#5A5A7A', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            No published {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} yet
          </p>
          <p style={{ color: '#3A3A5A', fontSize: '12px' }}>
            Create one and click "Save & Publish" to make it appear here
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {items.map(item => (
            <ArtifactCard
              key={item.id}
              item={item}
              type={activeTab}
              onRun={handleRun}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}