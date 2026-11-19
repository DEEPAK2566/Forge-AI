import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  ChevronRight, Save, Upload, Copy, RotateCcw,
  X, Check, Play
} from 'lucide-react'
import toolService from '../../services/toolService'
import { APP_NAME, LABELS } from '../../config/brand'

const PRACTICE_AREAS = [
  'AI/ML', 'API & Integration', 'Backend Engineering',
  'Business Operations', 'Cloud & DevOps', 'Cross-Functional',
  'Data Engineering', 'Enterprise Solutions', 'Frontend & UX',
  'Security & Compliance',
]

const FUNCTION_TYPES = [
  { value: 'data_retrieval',    label: 'Data Retrieval',    color: '#06B6D4', desc: 'Fetches data from external sources'    },
  { value: 'computation',       label: 'Computation',       color: '#10B981', desc: 'Processes or transforms data'           },
  { value: 'action_executor',   label: 'Action Executor',   color: '#F59E0B', desc: 'Performs actions (API calls, writes)'   },
  { value: 'content_generator', label: 'Content Generator', color: '#8B5CF6', desc: 'Generates text or structured output'    },
]

const METHODOLOGIES = [
  { value: 'quick_use', label: 'Quick Use', desc: 'Standalone — used once per task'          },
  { value: 'chained',   label: 'Chained',   desc: 'Output feeds into next tool or agent'     },
]

const SUGGESTED_TAGS = [
  'api', 'github', 'jira', 'sql', 's3', 'databricks',
  'slack', 'teams', 'excel', 'csv', 'json', 'http',
]

const DEFAULT_CODE = `from typing import Optional
from pydantic import BaseModel, Field
import requests
import json


# ── Input Schema ─────────────────────────────────────────────
class ToolInputSchema(BaseModel):
    """Input parameters for this tool."""
    query: str = Field(
        ...,
        description="The main input — replace with what your tool needs"
    )
    optional_param: Optional[str] = Field(
        None,
        description="An optional parameter — remove if not needed"
    )


# ── Tool Class ────────────────────────────────────────────────
class MyForgeTool:
    """
    FORGE Tool — replace this docstring with what your tool does.
    """

    name: str = "My Tool"
    description: str = "One sentence describing what this tool does"
    args_schema = ToolInputSchema

    def run(self, query: str, optional_param: Optional[str] = None) -> str:
        """
        Main logic. Called by the agent when it needs this tool.
        Replace the body below with your actual logic.
        """
        try:
            result = f"Tool received: {query}"
            return result
        except Exception as e:
            return f"Error: {str(e)}"
`

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

export default function ToolBuilder() {
  const navigate      = useNavigate()
  const { toolId }    = useParams()           // present when editing
  const isEditMode    = Boolean(toolId)

  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(isEditMode)
  const [isDirty,  setIsDirty]  = useState(false)
  const [error,    setError]    = useState('')
  const [copied,   setCopied]   = useState(false)
  const [tagInput, setTagInput] = useState('')

  const [form, setForm] = useState({
    name:          '',
    description:   '',
    tool_class:    '',
    code:          DEFAULT_CODE,
    practice_area: '',
    good_at:       [],
    function_type: '',
    methodology:   '',
  })

  // Load existing tool when in edit mode
  useEffect(() => {
    if (!isEditMode) return
    toolService.get(parseInt(toolId))
      .then(tool => {
        setForm({
          name:          tool.name          || '',
          description:   tool.description   || '',
          tool_class:    tool.tool_class     || '',
          code:          tool.code           || DEFAULT_CODE,
          practice_area: tool.practice_area  || '',
          good_at:       tool.good_at        || [],
          function_type: tool.function_type  || '',
          methodology:   tool.methodology    || '',
        })
      })
      .catch(() => setError('Could not open this tool. If someone else built it, find it in the Gallery and click Clone to get your own copy.'))
      .finally(() => setLoading(false))
  }, [toolId])

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
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

  const handleCopy = () => {
    navigator.clipboard.writeText(form.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    if (window.confirm('Reset code to the default template? Your changes will be lost.')) {
      update('code', DEFAULT_CODE)
    }
  }

  const handleSave = async (status = 'draft') => {
    if (!form.name.trim()) {
      setError(`${LABELS.connector} name is required.`)
      return
    }
    setError('')
    setSaving(true)
    try {
      if (isEditMode) {
        await toolService.update(parseInt(toolId), { ...form, status })
      } else {
        await toolService.create({ ...form, status })
      }
      navigate('/myspace')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save tool.')
    } finally {
      setSaving(false)
    }
  }

  const panelStyle = {
    backgroundColor: '#13131F', border: '1px solid #2A2A3D',
    borderRadius: '16px', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', height: '100%',
  }

  const panelHeader = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #2A2A3D',
    backgroundColor: '#1A1A2E', flexShrink: 0,
  }

  const gap = { marginBottom: '18px' }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0D0D14', color: '#5A5A7A', fontSize: '14px' }}>
        Loading tool...
      </div>
    )
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
          <span style={{ color: '#F0F0FF', fontWeight: '500' }}>
            {isEditMode ? `Edit ${LABELS.connector.toLowerCase()}` : LABELS.connector}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
            {isDirty ? 'Unsaved changes' : isEditMode ? 'Viewing saved tool' : 'Not saved yet'}
          </span>
          <button onClick={() => handleSave('draft')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#F0F0FF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} /> Save Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: saving ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)', border: 'none', color: 'white', cursor: 'pointer', boxShadow: saving ? 'none' : '0 0 16px rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Upload size={13} /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Metadata */}
        <div style={{ ...panelStyle, width: '300px', flexShrink: 0 }}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>🔧</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>{LABELS.connector} details</span>
            </div>
          </div>

          <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>

            <div style={gap}>
              <Label text={`${LABELS.connector} name`} required />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. GitHub File Reader" style={inputStyle} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            <div style={gap}>
              <Label text="What it does" />
              <textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe what this tool does in 1–2 sentences..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 14px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2A2A3D' }} />
              <span style={{ fontSize: '10px', color: '#5A5A7A', fontWeight: '500', letterSpacing: '0.05em' }}>FILTER CONFIGURATION</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2A2A3D' }} />
            </div>

            <div style={gap}>
              <Label text="Practice Area" />
              <select value={form.practice_area} onChange={e => update('practice_area', e.target.value)} style={{ ...inputStyle, color: form.practice_area ? '#F0F0FF' : '#5A5A7A' }}>
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={gap}>
              <Label text="Good At" />
              <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Type and press Enter..." style={{ ...inputStyle, marginBottom: '8px' }} onFocus={e => e.target.style.borderColor='#7C3AED'} onBlur={e => e.target.style.borderColor='#2A2A3D'} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {form.good_at.map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#8B5CF6' }}>
                    {tag} <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)} />
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

            <div style={gap}>
              <Label text="Function Type" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {FUNCTION_TYPES.map(ft => (
                  <button key={ft.value} onClick={() => update('function_type', ft.value)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', backgroundColor: form.function_type === ft.value ? `${ft.color}15` : 'transparent', border: `1px solid ${form.function_type === ft.value ? ft.color + '60' : '#2A2A3D'}`, transition: 'all 0.15s', textAlign: 'left' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${form.function_type === ft.value ? ft.color : '#2A2A3D'}`, backgroundColor: form.function_type === ft.value ? ft.color : 'transparent', flexShrink: 0, transition: 'all 0.15s' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: form.function_type === ft.value ? ft.color : '#8B8BB3' }}>{ft.label}</div>
                      <div style={{ fontSize: '10px', color: '#5A5A7A', marginTop: '1px' }}>{ft.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label text="Methodology" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {METHODOLOGIES.map(m => (
                  <button key={m.value} onClick={() => update('methodology', m.value)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', backgroundColor: form.methodology === m.value ? 'rgba(124,58,237,0.1)' : 'transparent', border: `1px solid ${form.methodology === m.value ? 'rgba(124,58,237,0.4)' : '#2A2A3D'}`, transition: 'all 0.15s', textAlign: 'left' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${form.methodology === m.value ? '#7C3AED' : '#2A2A3D'}`, backgroundColor: form.methodology === m.value ? '#7C3AED' : 'transparent', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: form.methodology === m.value ? '#7C3AED' : '#8B8BB3' }}>{m.label}</div>
                      <div style={{ fontSize: '10px', color: '#5A5A7A', marginTop: '1px' }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT — Code Editor */}
        <div style={{ ...panelStyle, flex: 1 }}>
          <div style={panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>⚙️</span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>Python code</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={handleCopy} style={{ padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: copied ? '#10B981' : '#8B8BB3', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleReset} style={{ padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent', border: '1px solid #2A2A3D', color: '#8B8BB3', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>

          {/* Tool class name bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#0D0D14', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#5A5A7A', whiteSpace: 'nowrap' }}>Class name</span>
              <input type="text" value={form.tool_class} onChange={e => update('tool_class', e.target.value)} placeholder="e.g. GitHubFileTool   (must match your class name in the code)" style={{ flex: 1, backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #2A2A3D', borderRadius: 0, padding: '4px 0', color: '#06B6D4', fontSize: '13px', fontFamily: 'monospace' }} onFocus={e => e.target.style.borderBottomColor='#7C3AED'} onBlur={e => e.target.style.borderBottomColor='#2A2A3D'} />
            </div>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={form.code}
              onChange={value => update('code', value || '')}
              options={{
                fontSize: 13, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false }, scrollBeyondLastLine: false,
                lineNumbers: 'on', automaticLayout: true, tabSize: 4,
                wordWrap: 'on', lineHeight: 22, padding: { top: 16 },
                scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}