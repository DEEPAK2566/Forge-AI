import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { BookOpen, Shield, Plug, ChevronRight, ChevronDown, Save, Upload, X, Plus, FileText, Sparkles, Cpu } from 'lucide-react'
import agentService     from '../../services/agentService'
import SelectItemsModal from '../../components/agent/SelectItemsModal'
import api              from '../../services/api'
import { APP_NAME, LABELS } from '../../config/brand'

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

const MODELS = {
  gemini: [
    { value: 'gemini-flash-latest',      label: 'Gemini Flash — latest (recommended)' },
    { value: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite — latest (more free requests)' },
    { value: 'gemini-pro-latest',        label: 'Gemini Pro — latest (smarter, small free quota)' },
  ],
  groq: [
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B on Groq (smarter)' },
    { value: 'openai/gpt-oss-20b',  label: 'GPT-OSS 20B on Groq (fastest)' },
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

function Slider({ label, hint, value, min, max, step = 0.01, suffix = '', onChange }) {
  return (
    <div style={{ marginBottom: '12px' }} title={hint}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#8B8BB3' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600' }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

// A column on the Agent screen (defined outside the screen so inputs keep focus while typing)
function Panel({ icon, title, note, children, className = '' }) {
  return (
    <section className={`ab-panel ${className}`}>
      <div className="ab-panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#F0F0FF' }}>{title}</span>
        </div>
        {note && <span style={{ fontSize: '11px', color: '#7A7A9E' }}>{note}</span>}
      </div>
      <div className="ab-panel-body">{children}</div>
    </section>
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
  const [showMore,         setShowMore]          = useState(false)
  // id → name, so selected connectors / libraries / guardrails show their names (not "#3")
  const [names,            setNames]             = useState({ tools: {}, knowledge_bases: {}, guardrails: {} })

  useEffect(() => {
    const load = (key, url) => api.get(url)
      .then(r => setNames(prev => ({ ...prev, [key]: Object.fromEntries(r.data.map(x => [x.id, x.name])) })))
      .catch(() => {})
    load('tools', '/tools/'); load('knowledge_bases', '/knowledge-bases/'); load('guardrails', '/guardrails/')
  }, [modal === null])


  const [form, setForm] = useState({
    name: '', details: '', avatar_emoji: '🤖', avatar_color: '#7C3AED',
    role: '', goal: '', backstory: '', description: '',
    practice_area: '', good_at: [],
    ai_engine: 'gemini', model: 'gemini-flash-latest',
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
          goal:               [agent.goal, agent.backstory && `Background: ${agent.backstory}`].filter(Boolean).join('\n\n'),
          backstory:          '',
          description:        agent.description      || '',
          practice_area:      agent.practice_area    || '',
          good_at:            agent.good_at          || [],
          ai_engine:          agent.ai_engine        || 'gemini',
          model:              agent.model            || 'gemini-flash-latest',
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
      .catch(() => setError('Could not open this agent. If someone else built it, find it in the Gallery and click Clone to get your own copy.'))
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0D0D14', color: '#5A5A7A', fontSize: '14px' }}>
        Loading agent...
      </div>
    )
  }

  const focus = color => ({ onFocus: e => { e.target.style.borderColor = color }, onBlur: e => { e.target.style.borderColor = '#2A2A3D' } })

  // One row in the Abilities panel (connectors / library / guardrails)
  const ability = ({ type, field, icon: Icon, color, title, hint }) => {
    const ids = form[field]
    return (
      <div className="ab-ability" style={{ borderColor: ids.length ? `${color}55` : '#2A2A3D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '9px', backgroundColor: `${color}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0FF' }}>
              {title} {ids.length > 0 && <span style={{ color, fontWeight: 600 }}>({ids.length})</span>}
            </div>
            <div style={{ fontSize: '11px', color: '#7A7A9E' }}>{hint}</div>
          </div>
          <button onClick={() => setModal(type)} className="ab-add" style={{ color, borderColor: `${color}55` }}>
            <Plus size={11} /> {ids.length ? 'Change' : 'Add'}
          </button>
        </div>
        {ids.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
            {ids.map(id => (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: `${color}1A`, border: `1px solid ${color}40`, fontSize: '11px', color, maxWidth: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[type][id] || `#${id}`}</span>
                <X size={10} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => update(field, ids.filter(i => i !== id))} />
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }


  return (
    <div className="ab-page">
      <style>{`
        .ab-page { display: flex; flex-direction: column; height: 100vh; background: #0D0D14; }
        .ab-grid { display: grid; grid-template-columns: 290px minmax(0, 1fr) 320px; gap: 12px; padding: 12px; flex: 1; min-height: 0; }
        .ab-panel { background: #13131F; border: 1px solid #2A2A3D; border-radius: 16px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .ab-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #2A2A3D; background: #181828; flex-shrink: 0; }
        .ab-panel-body { padding: 14px 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .ab-field { margin-bottom: 14px; }
        .ab-ability { border: 1px solid #2A2A3D; border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; background: #171726; }
        .ab-add { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 600; background: transparent; border: 1px solid; cursor: pointer; flex-shrink: 0; }
        .ab-section-label { font-size: 12px; font-weight: 600; color: #C4C4E0; margin: 6px 0 10px; display: flex; align-items: center; gap: 6px; }
        @media (max-width: 1100px) {
          .ab-page { height: auto; min-height: 100vh; }
          .ab-grid { grid-template-columns: 1fr; }
          .ab-panel-body { overflow: visible; }
        }
      `}</style>

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
          <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>{APP_NAME}</Link>
          <ChevronRight size={13} />
          <span>{LABELS.studio}</span>
          <ChevronRight size={13} />
          <span style={{ color: '#F0F0FF', fontWeight: '500' }}>
            {isEditMode ? `Edit ${LABELS.agent.toLowerCase()}` : `New ${LABELS.agent.toLowerCase()}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '12px', color: '#EF4444', maxWidth: '420px' }}>{error}</span>}
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
            {isDirty ? 'Unsaved changes' : isEditMode ? 'Saved' : 'Not saved yet'}
          </span>
          <button onClick={() => handleSave('draft')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#F0F0FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} /> Save draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: saving ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)', border: 'none', color: 'white', cursor: 'pointer', boxShadow: saving ? 'none' : '0 0 16px rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Upload size={13} /> {saving ? 'Saving...' : 'Save & publish'}
          </button>
        </div>
      </div>

      <div className="ab-grid">

        {/* ── LEFT: About ───────────────────────────────────────── */}
        <Panel icon={<span style={{ fontSize: '15px' }}>{form.avatar_emoji}</span>} title="About" note="Name is required">
          <div className="ab-field" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} title="Change icon" style={{ width: '50px', height: '50px', borderRadius: '14px', flexShrink: 0, background: `linear-gradient(135deg, ${form.avatar_color}, ${form.avatar_color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'pointer', border: '1px solid #2A2A3D' }}>
              {form.avatar_emoji}
            </button>
            <div style={{ flex: 1 }}>
              <Label text={`${LABELS.agent} name`} required />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. File Reader" style={{ ...input, borderColor: !form.name && error ? '#EF4444' : '#2A2A3D' }} {...focus('#7C3AED')} />
            </div>
          </div>

          {showAvatarPicker && (
            <div style={{ backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D', borderRadius: '12px', padding: '10px', marginBottom: '14px', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px' }}>
              {AVATAR_OPTIONS.map((emoji, i) => (
                <button key={emoji} onClick={() => { update('avatar_emoji', emoji); update('avatar_color', AVATAR_COLORS[i]); setShowAvatarPicker(false) }} style={{ padding: '6px 0', fontSize: '17px', borderRadius: '8px', cursor: 'pointer', border: form.avatar_emoji === emoji ? '1px solid #7C3AED' : '1px solid transparent', backgroundColor: form.avatar_emoji === emoji ? 'rgba(124,58,237,0.15)' : 'transparent' }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className="ab-field">
            <Label text="Short description" />
            <textarea value={form.details} onChange={e => update('details', e.target.value)} placeholder="One line people see on the card in the Gallery" rows={2} style={{ ...input, resize: 'none' }} {...focus('#7C3AED')} />
          </div>

          <div className="ab-field">
            <Label text="Practice area" />
            <select value={form.practice_area} onChange={e => update('practice_area', e.target.value)} style={{ ...input, color: form.practice_area ? '#F0F0FF' : '#5A5A7A' }}>
              <option value="">Select practice area</option>
              {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="ab-field" style={{ marginBottom: 0 }}>
            <Label text="Good at" />
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Type a skill and press Enter" style={{ ...input, marginBottom: '8px' }} {...focus('#7C3AED')} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {form.good_at.map(tag => (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', fontSize: '11px', color: '#A78BFA' }}>
                  {tag} <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)} />
                </span>
              ))}
              {SUGGESTED_TAGS.filter(t => !form.good_at.includes(t)).slice(0, 5).map(tag => (
                <button key={tag} onClick={() => update('good_at', [...form.good_at, tag])} style={{ padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px dashed #2A2A3D', fontSize: '11px', color: '#6A6A8E' }}>
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* ── MIDDLE: Instructions ──────────────────────────────── */}
        <Panel icon={<FileText size={15} color="#22D3EE" />} title="Instructions" note="What the agent is and what it must do">
          <div className="ab-field">
            <Label text="Role" />
            <input type="text" value={form.role} onChange={e => update('role', e.target.value)} placeholder="Who the agent is, e.g. Data engineer who reads the daily orders file" style={input} {...focus('#22D3EE')} />
          </div>

          <div className="ab-field">
            <Label text="Goal" />
            <textarea value={form.goal} onChange={e => update('goal', e.target.value)} placeholder="The one result it must deliver" rows={2} style={{ ...input, resize: 'vertical' }} {...focus('#22D3EE')} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '220px' }}>
            <Label text="Step-by-step instructions" required />
            <p style={{ fontSize: '11.5px', color: '#8B8BB3', margin: '-2px 0 8px', lineHeight: 1.5 }}>
              Write <code style={{ color: '#C4B5FD', backgroundColor: 'rgba(124,58,237,0.15)', padding: '1px 5px', borderRadius: '4px' }}>{'{{ name }}'}</code> where
              a value should come from the Run window, e.g. <code style={{ color: '#C4B5FD' }}>{'{{ file_date }}'}</code>. {APP_NAME} asks for each one when the workflow runs.
            </p>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder={`1. Call the Cloud File Reader once.\n2. If it returns an error, answer "READ FAILED: <message>".\n3. Otherwise list the row count and any empty values.\n\nUse only numbers from the tool result.`} style={{ ...input, flex: 1, resize: 'none', fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: '12px', lineHeight: '1.6', minHeight: '180px' }} {...focus('#22D3EE')} />
          </div>
        </Panel>

        {/* ── RIGHT: Abilities + Model ──────────────────────────── */}
        <Panel icon={<Sparkles size={15} color="#F59E0B" />} title="Abilities" note="All optional">
          {ability({ type: 'tools', field: 'tool_ids', icon: Plug, color: '#A78BFA', title: LABELS.connectors, hint: 'Reach apps and data: Azure, S3, GitHub…' })}
          {ability({ type: 'knowledge_bases', field: 'kb_ids', icon: BookOpen, color: '#22D3EE', title: LABELS.library, hint: 'Documents it reads before answering' })}
          {ability({ type: 'guardrails', field: 'guardrail_ids', icon: Shield, color: '#34D399', title: LABELS.guardrails, hint: 'Rules it must follow' })}

          <div className="ab-section-label" style={{ marginTop: '12px' }}><Cpu size={13} color="#F59E0B" /> Model</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['gemini', 'groq'].map(engine => (
              <button key={engine} onClick={() => changeEngine(engine)} style={{ flex: 1, padding: '7px 0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', border: form.ai_engine === engine ? '1px solid #7C3AED' : '1px solid #2A2A3D', backgroundColor: form.ai_engine === engine ? 'rgba(124,58,237,0.15)' : 'transparent', color: form.ai_engine === engine ? '#C4B5FD' : '#6A6A8E' }}>
                {engine === 'gemini' ? 'Gemini' : 'Groq'}
              </button>
            ))}
          </div>
          <select value={form.model} onChange={e => update('model', e.target.value)} style={{ ...input, marginBottom: '14px' }}>
            {MODELS[form.ai_engine]?.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <Slider label="Creativity (temperature)" hint="Low = follows instructions exactly. High = more creative." value={form.temperature} min={0} max={1} step={0.01} onChange={v => update('temperature', v)} />
          <Slider label="Max tool rounds" hint="How many times it may call tools before it must answer" value={form.max_iterations} min={1} max={20} step={1} onChange={v => update('max_iterations', v)} />
          <Slider label="Time limit" hint="The agent is stopped after this long" value={form.max_execution_time} min={30} max={600} step={10} suffix="s" onChange={v => update('max_execution_time', v)} />

          <button onClick={() => setShowMore(!showMore)} style={{ background: 'none', border: 'none', color: '#7A7A9E', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
            <ChevronDown size={12} style={{ transform: showMore ? 'rotate(180deg)' : 'none' }} /> More settings
          </button>
          {showMore && (
            <div style={{ marginTop: '10px' }}>
              <Slider label="Top P" hint="Leave at 0.9 unless you know you need it" value={form.top_p} min={0} max={1} step={0.01} onChange={v => update('top_p', v)} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
