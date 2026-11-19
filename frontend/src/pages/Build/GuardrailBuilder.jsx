import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronRight, Save, Upload, Shield, Plus, X } from 'lucide-react'
import guardrailService from '../../services/guardrailService'
import { APP_NAME, LABELS } from '../../config/brand'

const RULE_TEMPLATES = [
  'Never share confidential or private information.',
  'Always respond in English only.',
  'Do not generate harmful, abusive, or offensive content.',
  'Stay strictly on topic. Refuse off-topic requests politely.',
  'Never execute or suggest SQL DELETE or DROP operations.',
  'Always cite uncertainty — say "I am not sure" rather than guessing.',
]

const inputStyle = {
  width: '100%', backgroundColor: '#0D0D14',
  border: '1px solid #2A2A3D', borderRadius: '8px',
  padding: '9px 12px', color: '#F0F0FF', fontSize: '13px',
}

function Label({ text, required }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#8B8BB3', marginBottom: '6px' }}>
      {text} {required && <span style={{ color: '#7C3AED' }}>*</span>}
    </label>
  )
}

export default function GuardrailBuilder() {
  const navigate  = useNavigate()
  const [saving,  setSaving]  = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    name:          '',
    description:   '',
    rules:         '',
    practice_area: '',
    status:        'draft',
  })

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const addTemplate = (rule) => {
    const current = form.rules.trim()
    const next    = current ? `${current}\n- ${rule}` : `- ${rule}`
    update('rules', next)
  }

  const handleSave = async (status = 'draft') => {
    if (!form.name.trim()) {
      setError('Guardrail name is required.')
      return
    }
    if (!form.rules.trim()) {
      setError('At least one rule is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await guardrailService.create({ ...form, status })
      navigate('/myspace')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save guardrail.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0D0D14' }}>

      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#0D0D14', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A5A7A' }}>
          <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>{APP_NAME}</Link>
          <ChevronRight size={13} />
          <span>{LABELS.studio}</span>
          <ChevronRight size={13} />
          <span style={{ color: '#F0F0FF', fontWeight: '500' }}>Guardrail</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>{isDirty ? 'Unsaved changes' : 'Not saved yet'}</span>
          <button onClick={() => handleSave('draft')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#F0F0FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} /> Save Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: saving ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: saving ? 'none' : '0 0 16px rgba(124,58,237,0.3)' }}>
            <Upload size={13} /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px', flex: 1, overflow: 'hidden' }}>

        {/* Left — Metadata */}
        <div style={{ width: '300px', flexShrink: 0, backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 18px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
            <Shield size={15} color="#10B981" />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>Guardrail</span>
          </div>

          <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <Label text="Name" required />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Data Privacy Policy" style={inputStyle} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Label text="Description" />
              <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="What does this guardrail protect against?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div>
              <Label text="Quick Add Rules" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {RULE_TEMPLATES.map((rule, i) => (
                  <button key={i} onClick={() => addTemplate(rule)} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: '7px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#8B8BB3', fontSize: '11px', lineHeight: '1.45', display: 'flex', alignItems: 'flex-start', gap: '6px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#7C3AED'; e.currentTarget.style.color='#F0F0FF' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#2A2A3D'; e.currentTarget.style.color='#8B8BB3' }}>
                    <Plus size={11} style={{ flexShrink: 0, marginTop: '1px' }} />
                    {rule}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Rules Editor */}
        <div style={{ flex: 1, backgroundColor: '#13131F', border: '1px solid #2A2A3D', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>Rules</span>
            <span style={{ fontSize: '12px', color: '#5A5A7A', marginLeft: '8px' }}>
              One rule per line — these are injected into every agent that uses this guardrail
            </span>
          </div>

          <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <textarea
              value={form.rules}
              onChange={e => update('rules', e.target.value)}
              placeholder={`Write your guardrail rules here. Example:\n\n- Never share confidential data.\n- Always respond in English.\n- Do not answer questions outside the scope of data engineering.\n- If unsure, say "I don't know" rather than guessing.`}
              style={{ ...inputStyle, flex: 1, resize: 'none', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.65', minHeight: '300px' }}
              onFocus={e => e.target.style.borderColor='#10B981'}
              onBlur={e  => e.target.style.borderColor='#2A2A3D'}
            />
            <p style={{ fontSize: '12px', color: '#5A5A7A', marginTop: '10px' }}>
              These rules are added to the top of the agent's system prompt as constraints. Write them as clear, direct instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}