import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Zap, BookOpen, Shield, Wrench, ChevronRight, Save, Upload, X, Plus, Check } from 'lucide-react'
import agentService     from '../../services/agentService'
import SelectItemsModal from '../../components/agent/SelectItemsModal'

const PRACTICE_AREAS = [
  'AI/ML', 'API & Integration', 'Backend Engineering', 'Business Operations',
  'Cloud & DevOps', 'Cross-Functional', 'Data Engineering', 'Enterprise Solutions',
  'Frontend & UX', 'Security & Compliance',
]

const SUGGESTED_TAGS = [
  'classification', 'qa', 'refactor', 'retrieval',
  'scheduling', 'generation', 'summarization', 'analysis',
  'validation', 'monitoring', 'parsing', 'conversion',
]

const BEHAVIOR_PRESETS = ['Balanced', 'Deterministic', 'Creative', 'Verbose', 'Fast/Light']

const MODELS = {
  gemini: [
    { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash (Free — fastest)' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Free)' },
    { value: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash (Free — stable)' },
    { value: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro (slower, smarter)' },
  ],
  groq: [
    { value: 'llama3-8b-8192',      label: 'Llama 3 8B (Free — fastest)' },
    { value: 'llama3-70b-8192',     label: 'Llama 3 70B (Free — smarter)' },
    { value: 'mixtral-8x7b-32768',  label: 'Mixtral 8x7B (Free)' },
  ],
}

const AVATAR_OPTIONS = ['🤖', '🧠', '⚡', '🔍', '🛠️', '🎯', '📊', '🚀']
const AVATAR_COLORS  = ['#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#4F46E5', '#0F766E']

const input = {
  width: '100%', backgroundColor: '#0D0D14',
  border: '1px solid #2A2A3D', borderRadius: '8px',
  padding: '9px 12px', color: '#F0F0FF', fontSize: '13px', lineHeight: '1.5',
}

function Label({ text, required }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#8B8BB3', marginBottom: '6px' }}>
      {text} {required && <span style={{ color: '#7C3AED' }}>*</span>}
    </label>
  )
}

function Slider({ label, value, min, max, step = 0.01, suffix = '', onChange }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#8B8BB3' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600' }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

export default function AgentBuilder() {
  const navigate           = useNavigate()
  const { agentId }        = useParams()  // present when editing an existing agent
  const isEditMode         = Boolean(agentId)

  const [isDirty,          setIsDirty]          = useState(false)
  const [saving,           setSaving]            = useState(false)
  const [loading,          setLoading]           = useState(isEditMode)
  const [error,            setError]             = useState('')
  const [showAvatarPicker, setShowAvatarPicker]  = useState(false)
  const [tagInput,         setTagInput]          = useState('')

  // Modal state for tool/kb/guardrail selection
  const [modal, setModal] = useState(null)  // null | 'tools' | 'knowledge_bases' | 'guardrails'

  const [form, setForm] = useState({
    name: '', details: '', avatar_emoji: '🤖', avatar_color: '#7C3AED',
    role: '', goal: '', backstory: '', description: '',
    practice_area: '', good_at: [],
    ai_engine: 'gemini', model: 'gemini-2.0-flash',
    behavior_preset: 'balanced', temperature: 0.7, top_p: 0.9,
    max_iterations: 5, max_rpm: 10, max_execution_time: 300,
    tool_ids: [], kb_ids: [], guardrail_ids: [],
  })

  // If editing, load existing agent data
  useEffect(() => {
    if (!isEditMode) return
    agentService.get(parseInt(agentId))
      .then(agent => {
        setForm({
          name:               agent.name             || '',
          details:            agent.details          || '',
          avatar_emoji:       agent.avatar_emoji     || '🤖',
          avatar_color:       agent.avatar_color     || '#7C3AED',
          role:               agent.role             || '',
          goal:               agent.goal             || '',
          backstory:          agent.backstory        || '',
          description:        agent.description      || '',
          practice_area:      agent.practice_area    || '',
          good_at:            agent.good_at          || [],
          ai_engine:          agent.ai_engine        || 'gemini',
          model:              agent.model            || 'gemini-2.0-flash',
          behavior_preset:    agent.behavior_preset  || 'balanced',
          temperature:        agent.temperature      ?? 0.7,
          top_p:              agent.top_p            ?? 0.9,
          max_iterations:     agent.max_iterations   ?? 5,
          max_rpm:            agent.max_rpm          ?? 10,
          max_execution_time: agent.max_execution_time ?? 300,
          tool_ids:           agent.tool_ids         || [],
          kb_ids:             agent.kb_ids           || [],
          guardrail_ids:      agent.guardrail_ids      || [],
        })
      })
      .catch(() => setError('Could not load agent. It may have been deleted.'))
      .finally(() => setLoading(false))
  }, [agentId])

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const changeEngine = (engine) => {
    update('ai_engine', engine)
    update('model', MODELS[engine][0].value)
  }

  const addTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase().replace(/,/g, '')
      if (tag && !form.good_at.includes(tag)) update('good_at', [...form.good_at, tag])
      setTagInput('')
    }
  }

  const removeTag = (tag) => update('good_at', form.good_at.filter(t => t !== tag))

  const handleSave = async (status = 'draft') => {
    // Validate required fields
    if (!form.name.trim()) {
      setError('Agent Name is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      if (isEditMode) {
        await agentService.update(parseInt(agentId), { ...form, status })
      } else {
        await agentService.create({ ...form, status })
      }
      navigate('/myspace')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save agent.')
    } finally {
      setSaving(false)
    }
  }

  const panelStyle = {
    backgroundColor: '#13131F', border: '1px solid #2A2A3D',
    borderRadius: '16px', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', height: '100%',
  }

  const panelHeader = (color = '#7C3AED') => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #2A2A3D',
    backgroundColor: '#1A1A2E', flexShrink: 0,
  })

  const panelBody = { padding: '18px', overflowY: 'auto', flex: 1 }
  const gap = { marginBottom: '18px' }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0D0D14', color: '#5A5A7A', fontSize: '14px' }}>
        Loading agent...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0D0D14' }}>

      {/* Modals */}
      {modal && (
        <SelectItemsModal
          type={modal}
          currentIds={
            modal === 'tools'           ? form.tool_ids :
            modal === 'knowledge_bases' ? form.kb_ids   :
                                          form.guardrail_ids
          }
          onConfirm={(ids) => {
            if (modal === 'tools')           update('tool_ids', ids)
            if (modal === 'knowledge_bases') update('kb_ids', ids)
            if (modal === 'guardrails')      update('guardrail_ids', ids)
            setModal(null)
          }}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#0D0D14', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A5A7A' }}>
          <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>FORGE</Link>
          <ChevronRight size={13} />
          <span>Build</span>
          <ChevronRight size={13} />
          <span style={{ color: '#F0F0FF', fontWeight: '500' }}>
            {isEditMode ? 'Edit Agent' : 'Agent'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
            {isDirty ? 'Unsaved changes' : isEditMode ? 'Viewing saved agent' : 'Not saved yet'}
          </span>
          <button onClick={() => handleSave('draft')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#F0F0FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} /> Save Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: saving ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)', border: 'none', color: 'white', cursor: 'pointer', boxShadow: saving ? 'none' : '0 0 16px rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Upload size={13} /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Agent Identity */}
        <div style={{ ...panelStyle, width: '280px', flexShrink: 0 }}>
          <div style={panelHeader()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>🤖</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>Agent</span>
            </div>
            <span style={{ fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(124,58,237,0.15)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}>Required</span>
          </div>

          <div style={panelBody}>
            {/* Avatar picker */}
            <div style={{ ...gap, display: 'flex', justifyContent: 'center' }}>
              <div onClick={() => setShowAvatarPicker(!showAvatarPicker)} style={{ width: '72px', height: '72px', borderRadius: '18px', background: `linear-gradient(135deg, ${form.avatar_color}, ${form.avatar_color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', cursor: 'pointer', border: '2px solid #2A2A3D', boxShadow: `0 0 20px ${form.avatar_color}33` }}>
                {form.avatar_emoji}
              </div>
            </div>

            {showAvatarPicker && (
              <div style={{ backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', borderRadius: '12px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  {AVATAR_OPTIONS.map((emoji, i) => (
                    <button key={emoji} onClick={() => { update('avatar_emoji', emoji); update('avatar_color', AVATAR_COLORS[i]) }} style={{ padding: '8px', fontSize: '18px', borderRadius: '8px', cursor: 'pointer', border: form.avatar_emoji === emoji ? '1px solid #7C3AED' : '1px solid transparent', backgroundColor: form.avatar_emoji === emoji ? 'rgba(124,58,237,0.15)' : 'transparent' }}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAvatarPicker(false)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#2A2A3D', color: '#F0F0FF', fontSize: '12px', cursor: 'pointer' }}>Done</button>
              </div>
            )}

            {/* Agent Name */}
            <div style={gap}>
              <Label text="Agent Name" required />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. CDM Pipeline Monitor" style={{ ...input, borderColor: !form.name && error ? '#EF4444' : '#2A2A3D' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor = (!form.name && error ? '#EF4444' : '#2A2A3D')} />
            </div>

            <div style={gap}>
              <Label text="Agent Details" />
              <textarea value={form.details} onChange={e => update('details', e.target.value)} placeholder="Brief description..." rows={3} style={{ ...input, resize: 'vertical' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div style={gap}>
              <Label text="Practice Area" />
              <select value={form.practice_area} onChange={e => update('practice_area', e.target.value)} style={{ ...input, color: form.practice_area ? '#F0F0FF' : '#5A5A7A' }}>
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={gap}>
              <Label text="Good At" />
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Type and press Enter..." style={{ ...input, marginBottom: '8px' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                {form.good_at.map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: '11px', color: '#8B5CF6' }}>
                    + {tag} <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)} />
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {SUGGESTED_TAGS.filter(t => !form.good_at.includes(t)).slice(0, 6).map(tag => (
                  <button key={tag} onClick={() => update('good_at', [...form.good_at, tag])} style={{ padding: '2px 7px', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #2A2A3D', fontSize: '11px', color: '#5A5A7A' }}>
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #2A2A3D', margin: '16px 0' }} />

            {/* Knowledge Base selection */}
            <div style={gap}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={13} color="#06B6D4" />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#F0F0FF' }}>Knowledge Base</span>
                </div>
                <span style={{ fontSize: '10px', color: '#5A5A7A' }}>Optional</span>
              </div>
              {/* Show selected KBs as chips */}
              {form.kb_ids.length > 0 && (
                <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {form.kb_ids.map(id => (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', fontSize: '11px', color: '#06B6D4' }}>
                      KB #{id}
                      <X size={10} style={{ cursor: 'pointer' }} onClick={() => update('kb_ids', form.kb_ids.filter(i => i !== id))} />
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => setModal('knowledge_bases')} style={{ width: '100%', padding: '8px', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px dashed #2A2A3D', color: '#5A5A7A', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Plus size={12} /> {form.kb_ids.length > 0 ? 'Change Knowledge Base' : 'Add Knowledge Base'}
              </button>
            </div>

            {/* Guardrails section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={13} color="#10B981" />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#F0F0FF' }}>Guardrails</span>
                </div>
                <span style={{ fontSize: '10px', color: '#5A5A7A' }}>Optional</span>
              </div>
              {form.guardrail_ids.length > 0 && (
                <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {form.guardrail_ids.map(id => (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '11px', color: '#10B981' }}>
                      Guardrail #{id}
                      <X size={10} style={{ cursor: 'pointer' }} onClick={() => update('guardrail_ids', form.guardrail_ids.filter(i => i !== id))} />
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => setModal('guardrails')} style={{ width: '100%', padding: '8px', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px dashed #2A2A3D', color: '#5A5A7A', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Plus size={12} /> {form.guardrail_ids.length > 0 ? 'Change Guardrails' : 'Add Guardrails'}
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE — Behaviour */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHeader('#06B6D4')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={15} color="#06B6D4" />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>Behaviour</span>
            </div>
            <span style={{ fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }}>Required</span>
          </div>

          <div style={panelBody}>
            <div style={gap}>
              <Label text="Agent Role" />
              <input type="text" value={form.role} onChange={e => update('role', e.target.value)} placeholder="e.g. Principal Data Pipeline Analyst" style={input} onFocus={e => e.target.style.borderColor='#06B6D4'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
              <p style={{ fontSize: '11px', color: '#5A5A7A', marginTop: '5px' }}>The persona this agent embodies when completing tasks</p>
            </div>

            <div style={gap}>
              <Label text="Goal" />
              <textarea value={form.goal} onChange={e => update('goal', e.target.value)} placeholder="State the primary outcome..." rows={4} style={{ ...input, resize: 'vertical' }} onFocus={e => e.target.style.borderColor='#06B6D4'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div style={gap}>
              <Label text="Back Story" />
              <textarea value={form.backstory} onChange={e => update('backstory', e.target.value)} placeholder="Explain the context..." rows={4} style={{ ...input, resize: 'vertical' }} onFocus={e => e.target.style.borderColor='#06B6D4'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div>
              <Label text="Description / Instructions" required />
              <div style={{ marginBottom: '6px', padding: '8px 12px', backgroundColor: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '8px' }}>
                <p style={{ fontSize: '11px', color: '#8B5CF6', lineHeight: '1.5' }}>
                  💡 Use <code style={{ backgroundColor: 'rgba(124,58,237,0.15)', padding: '1px 5px', borderRadius: '3px' }}>{'{{ variable_name }}'}</code> for dynamic inputs.
                  When this agent runs in a workflow, FORGE will show an input field for each variable.
                  Example: <code style={{ color: '#A78BFA' }}>{'Fetch files from {{ repo_url }} on {{ branch_name }}'}</code>
                </p>
              </div>
              <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={14} placeholder={`Detail the logic, steps, or special rules.\n\nExample with variables:\nINSTRUCTIONS:\n1. Fetch the repository from {{ repo_url }} on branch {{ branch_name }}\n2. Analyze the files and classify any issues\n3. Return a structured report\n\nOUTPUT FORMAT:\n- Summary: [text]\n- Issues Found: [list]`} style={{ ...input, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }} onFocus={e => e.target.style.borderColor='#06B6D4'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>
          </div>
        </div>

        {/* RIGHT — LLM Config */}
        <div style={{ ...panelStyle, width: '280px', flexShrink: 0 }}>
          <div style={panelHeader('#F59E0B')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>🔮</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>LLM Config</span>
            </div>
            <span style={{ fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>Required</span>
          </div>

          <div style={panelBody}>
            <div style={gap}>
              <Label text="AI Engine" required />
              <div style={{ display: 'flex', gap: '6px' }}>
                {['gemini', 'groq'].map(engine => (
                  <button key={engine} onClick={() => changeEngine(engine)} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s', border: form.ai_engine === engine ? '1px solid #7C3AED' : '1px solid #2A2A3D', backgroundColor: form.ai_engine === engine ? 'rgba(124,58,237,0.15)' : 'transparent', color: form.ai_engine === engine ? '#7C3AED' : '#5A5A7A' }}>
                    {engine === 'gemini' ? '⚡ Gemini' : '🦙 Groq'}
                  </button>
                ))}
              </div>
            </div>

            <div style={gap}>
              <Label text="Model" required />
              <select value={form.model} onChange={e => update('model', e.target.value)} style={input}>
                {MODELS[form.ai_engine]?.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div style={gap}>
              <Label text="Behavior Preset" required />
              <select value={form.behavior_preset} onChange={e => update('behavior_preset', e.target.value)} style={input}>
                {BEHAVIOR_PRESETS.map(p => <option key={p} value={p.toLowerCase().replace('/', '_')}>{p}</option>)}
              </select>
            </div>

            <div style={{ borderTop: '1px solid #2A2A3D', margin: '14px 0' }} />

            <Slider label="Temperature"         value={form.temperature}        min={0}  max={1}   step={0.01} onChange={v => update('temperature', v)} />
            <Slider label="Top P"                value={form.top_p}              min={0}  max={1}   step={0.01} onChange={v => update('top_p', v)} />
            <Slider label="Max Iterations"       value={form.max_iterations}     min={1}  max={20}  step={1}    onChange={v => update('max_iterations', v)} />
            <Slider label="Max RPM"              value={form.max_rpm}            min={1}  max={100} step={1}    onChange={v => update('max_rpm', v)} />
            <Slider label="Max Execution Time"   value={form.max_execution_time} min={30} max={600} step={10} suffix="s" onChange={v => update('max_execution_time', v)} />

            <div style={{ borderTop: '1px solid #2A2A3D', margin: '14px 0' }} />

            {/* Tools */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={13} color="#8B5CF6" />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#F0F0FF' }}>Tools</span>
                </div>
                <span style={{ fontSize: '10px', color: '#5A5A7A' }}>Optional</span>
              </div>
              {form.tool_ids.length > 0 && (
                <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {form.tool_ids.map(id => (
                    <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', fontSize: '11px', color: '#8B5CF6' }}>
                      Tool #{id}
                      <X size={10} style={{ cursor: 'pointer' }} onClick={() => update('tool_ids', form.tool_ids.filter(i => i !== id))} />
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => setModal('tools')} style={{ width: '100%', padding: '8px', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px dashed #2A2A3D', color: '#5A5A7A', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Plus size={12} /> {form.tool_ids.length > 0 ? 'Change Tools' : 'Add Tools'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}