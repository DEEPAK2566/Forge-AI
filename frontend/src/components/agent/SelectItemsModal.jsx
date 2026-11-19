import { useState, useEffect } from 'react'
import { X, Search, Check } from 'lucide-react'
import api from '../../services/api'
import { LABELS } from '../../config/brand'

export default function SelectItemsModal({ type, currentIds = [], onConfirm, onCancel }) {
  const [items,    setItems]    = useState([])
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(new Set(currentIds))
  const [loading,  setLoading]  = useState(true)

  // Endpoint + labels based on type
  const config = {
    tools:          { endpoint: '/tools/',           label: LABELS.connectors,           emoji: '🔧' },
    knowledge_bases:{ endpoint: '/knowledge-bases/', label: LABELS.libraries, emoji: '📚' },
    guardrails:     { endpoint: '/guardrails/',      label: 'Guardrails',      emoji: '🛡️' },
  }[type] || { endpoint: '/tools/', label: 'Items', emoji: '📦' }

  useEffect(() => {
    api.get(config.endpoint)
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}
    >
      <div style={{ backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#F0F0FF' }}>
            {config.emoji} Select {config.label}
          </h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} color="#5A5A7A" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A3D', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#5A5A7A" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${config.label.toLowerCase()}...`}
              style={{ width: '100%', backgroundColor: '#0D0D14', border: '1px solid #2A2A3D', borderRadius: '8px', padding: '7px 10px 7px 30px', color: '#F0F0FF', fontSize: '12px' }}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#5A5A7A', fontSize: '13px', padding: '24px' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <p style={{ color: '#5A5A7A', fontSize: '13px', marginBottom: '6px' }}>
                No {config.label.toLowerCase()} found
              </p>
              <p style={{ color: '#3A3A5A', fontSize: '12px' }}>
                Create one first in the {LABELS.studio}
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const isSelected = selected.has(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             '12px',
                    padding:         '10px 12px',
                    borderRadius:    '10px',
                    marginBottom:    '4px',
                    cursor:          'pointer',
                    backgroundColor: isSelected ? 'rgba(124,58,237,0.12)' : 'transparent',
                    border:          `1px solid ${isSelected ? 'rgba(124,58,237,0.35)' : 'transparent'}`,
                    transition:      'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#1A1A2E' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width:           '18px',
                    height:          '18px',
                    borderRadius:    '5px',
                    border:          `2px solid ${isSelected ? '#7C3AED' : '#2A2A3D'}`,
                    backgroundColor: isSelected ? '#7C3AED' : 'transparent',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    flexShrink:      0,
                    transition:      'all 0.15s',
                  }}>
                    {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#F0F0FF', marginBottom: '1px' }}>
                      {item.name}
                    </div>
                    {(item.description || item.tool_class) && (
                      <div style={{ fontSize: '11px', color: '#5A5A7A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || item.tool_class}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize:        '10px',
                    fontWeight:      '500',
                    padding:         '2px 7px',
                    borderRadius:    '4px',
                    backgroundColor: item.status === 'published' ? 'rgba(16,185,129,0.1)' : 'rgba(90,90,122,0.15)',
                    color:           item.status === 'published' ? '#10B981' : '#5A5A7A',
                    flexShrink:      0,
                  }}>
                    {item.status || 'draft'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
            {selected.size} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onCancel} style={{ padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#8B8BB3', fontSize: '13px' }}>
              Cancel
            </button>
            <button onClick={() => onConfirm(Array.from(selected))} style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', border: 'none', color: 'white', fontSize: '13px', fontWeight: '600' }}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}