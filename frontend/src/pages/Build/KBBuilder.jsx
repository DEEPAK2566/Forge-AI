import { useState, useRef } from 'react'
import { useNavigate, Link }  from 'react-router-dom'
import {
  ChevronRight, Save, Upload, X,
  FileText, File, CheckCircle,
  AlertCircle, Loader, GitBranch, CloudUpload,
} from 'lucide-react'
import kbService from '../../services/kbService'
import { APP_NAME, LABELS } from '../../config/brand'

// ── Static data ────────────────────────────────────────────────────────────

const PRACTICE_AREAS = [
  'AI/ML', 'API & Integration', 'Backend Engineering',
  'Business Operations', 'Cloud & DevOps', 'Cross-Functional',
  'Data Engineering', 'Enterprise Solutions',
]

const EMBEDDING_MODELS = [
  { value: 'default', label: 'Default (sentence-transformers)' },
]

// Source tabs — which input method to use
const SOURCE_TABS = [
  { id: 'upload', label: 'Upload Docs', icon: CloudUpload },
  { id: 'github', label: 'GitHub',      icon: GitBranch  },
]

// ── File type icon helper ──────────────────────────────────────────────────
function FileIcon({ filename }) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const color = ext === 'pdf' ? '#EF4444' : ext === 'docx' ? '#3B82F6' : '#10B981'
  return <FileText size={16} color={color} />
}

// ── Format file size ───────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Shared styles ──────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  backgroundColor: '#0D0D14',
  border: '1px solid #2A2A3D',
  borderRadius: '8px',
  padding: '9px 12px',
  color: '#F0F0FF',
  fontSize: '13px',
}

function Label({ text, required }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#8B8BB3', marginBottom: '6px' }}>
      {text} {required && <span style={{ color: '#7C3AED' }}>*</span>}
    </label>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function KBBuilder() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)  // ref to the hidden file input element

  const [saving,    setSaving]    = useState(false)
  const [isDirty,   setIsDirty]   = useState(false)
  const [error,     setError]     = useState('')
  const [activeTab, setActiveTab] = useState('upload')

  // Created KB ID — once the KB is saved, files are uploaded to this ID
  const [savedKbId, setSavedKbId] = useState(null)

  // Track upload progress and status for each file
  // Structure: [{ file, status: 'pending'|'uploading'|'done'|'error', progress, chunks, error }]
  const [uploadedFiles, setUploadedFiles] = useState([])

  const [isDragging, setIsDragging] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name:          '',
    description:   '',
    search_type:   'quick_search',
    chunk_size:    1000,
    practice_area: '',
    good_at:       [],
    methodology:   '',
  })

  // GitHub form state (UI only — GitHub file fetching comes in a later day)
  const [github, setGithub] = useState({
    key: '', account: '', repo: '', branch: ''
  })

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  // ── File upload logic ──────────────────────────────────────────────────

  // Update one file's state in the uploadedFiles array
  const updateFile = (index, updates) => {
    setUploadedFiles(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }

  // Upload a single file to the already-saved KB
  const uploadFile = async (fileObj, index, kbId) => {
    updateFile(index, { status: 'uploading', progress: 0 })
    try {
      const result = await kbService.uploadFile(
        kbId,
        fileObj.file,
        (progress) => updateFile(index, { progress })
      )
      updateFile(index, { status: 'done', chunks: result.chunks, progress: 100 })
    } catch (err) {
      updateFile(index, {
        status: 'error',
        error: err.response?.data?.detail || 'Upload failed',
      })
    }
  }

  // Add files from drag-drop or file picker
  const handleFiles = (files) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      status:   'pending',
      progress: 0,
      chunks:   0,
      error:    '',
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setIsDirty(true)
  }

  // Drag and drop event handlers
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true)  }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop      = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  // ── Save and upload flow ───────────────────────────────────────────────

  const handleSave = async (status = 'draft') => {
    if (!form.name.trim()) {
      setError(`${LABELS.library} name is required.`)
      return
    }
    setError('')
    setSaving(true)

    try {
      // Step 1: Save the KB record to get an ID
      const kb = await kbService.create({ ...form, status })
      setSavedKbId(kb.id)

      // Step 2: Upload all pending files to this KB
      const pendingFiles = uploadedFiles.filter(f => f.status === 'pending')
      for (let i = 0; i < uploadedFiles.length; i++) {
        if (uploadedFiles[i].status === 'pending') {
          await uploadFile(uploadedFiles[i], i, kb.id)
        }
      }

      // Step 3: Navigate back only if no errors
      const hasErrors = uploadedFiles.some(f => f.status === 'error')
      if (!hasErrors) {
        navigate('/myspace')
      }

    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save knowledge base.')
    } finally {
      setSaving(false)
    }
  }

  const panelStyle = {
    backgroundColor: '#13131F',
    border: '1px solid #2A2A3D',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  }

  const sectionGap = { marginBottom: '18px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0D0D14' }}>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '52px',
        borderBottom: '1px solid #2A2A3D', backgroundColor: '#0D0D14', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A5A7A' }}>
          <Link to="/myspace" style={{ color: '#5A5A7A', textDecoration: 'none' }}>{APP_NAME}</Link>
          <ChevronRight size={13} />
          <span>{LABELS.studio}</span>
          <ChevronRight size={13} />
          <span style={{ color: '#F0F0FF', fontWeight: '500' }}>{LABELS.library}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {error && <span style={{ fontSize: '12px', color: '#EF4444' }}>{error}</span>}
          <span style={{ fontSize: '12px', color: '#5A5A7A' }}>
            {isDirty ? 'Unsaved changes' : 'Not saved yet'}
          </span>
          <button onClick={() => handleSave('draft')} disabled={saving} style={{
            padding: '7px 16px', borderRadius: '8px', fontSize: '13px',
            backgroundColor: 'transparent', border: '1px solid #2A2A3D',
            color: '#F0F0FF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <Save size={13} /> Save Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} style={{
            padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            background: saving ? '#2A2A3D' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
            border: 'none', color: 'white', cursor: 'pointer',
            boxShadow: saving ? 'none' : '0 0 16px rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <Upload size={13} /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT PANEL — Metadata ─────────────────────────────────────── */}
        <div style={{ ...panelStyle, width: '300px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 18px', borderBottom: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
            <span style={{ fontSize: '15px' }}>📚</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#F0F0FF' }}>{LABELS.library} details</span>
          </div>

          <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>

            {/* Name */}
            <div style={sectionGap}>
              <Label text="Name" required />
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                placeholder="e.g. LEDM Pipeline Documentation"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
            </div>

            {/* Description */}
            <div style={sectionGap}>
              <Label text="Description" />
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                placeholder="What documents are in this knowledge base?"
                rows={3} style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e  => e.target.style.borderColor = '#2A2A3D'} />
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 14px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2A2A3D' }} />
              <span style={{ fontSize: '10px', color: '#5A5A7A', fontWeight: '500', letterSpacing: '0.05em' }}>
                EMBEDDING SETTINGS
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#2A2A3D' }} />
            </div>

            {/* Embedding Model */}
            <div style={sectionGap}>
              <Label text="Model" required />
              <select value="default" style={inputStyle} disabled>
                <option value="default">Default (sentence-transformers)</option>
              </select>
            </div>

            {/* Search Type */}
            <div style={sectionGap}>
              <Label text="Search Strategy" />
              {[
                { value: 'quick_search',  label: 'Quick Search',  desc: 'Fast retrieval, smaller chunks' },
                { value: 'deep_context',  label: 'Deep Context',  desc: 'Rich context, larger chunks'    },
              ].map(opt => (
                <button key={opt.value} onClick={() => update('search_type', opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                    width: '100%', marginBottom: '6px', textAlign: 'left',
                    backgroundColor: form.search_type === opt.value ? 'rgba(124,58,237,0.1)' : 'transparent',
                    border: `1px solid ${form.search_type === opt.value ? 'rgba(124,58,237,0.4)' : '#2A2A3D'}`,
                  }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${form.search_type === opt.value ? '#7C3AED' : '#2A2A3D'}`,
                    backgroundColor: form.search_type === opt.value ? '#7C3AED' : 'transparent',
                  }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: form.search_type === opt.value ? '#7C3AED' : '#8B8BB3' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#5A5A7A' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Chunk Size slider */}
            <div style={sectionGap}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#8B8BB3' }}>Split Size</span>
                <span style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600' }}>{form.chunk_size}</span>
              </div>
              <input type="range" min={200} max={5000} step={100}
                value={form.chunk_size}
                onChange={e => update('chunk_size', parseInt(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#5A5A7A', marginTop: '3px' }}>
                <span>200 (precise)</span>
                <span>(broad) 5000</span>
              </div>
            </div>

            {/* Practice Area */}
            <div style={sectionGap}>
              <Label text="Practice Area" />
              <select value={form.practice_area} onChange={e => update('practice_area', e.target.value)}
                style={{ ...inputStyle, color: form.practice_area ? '#F0F0FF' : '#5A5A7A' }}>
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── RIGHT PANEL — Source ──────────────────────────────────────── */}
        <div style={{ ...panelStyle, flex: 1 }}>

          {/* Source Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #2A2A3D', backgroundColor: '#1A1A2E', flexShrink: 0 }}>
            {SOURCE_TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '13px 20px', cursor: 'pointer',
                    backgroundColor: 'transparent', border: 'none',
                    borderBottom: `2px solid ${isActive ? '#7C3AED' : 'transparent'}`,
                    color: isActive ? '#F0F0FF' : '#5A5A7A',
                    fontSize: '13px', fontWeight: isActive ? '500' : '400',
                    transition: 'all 0.2s',
                  }}>
                  <Icon size={14} color={isActive ? '#7C3AED' : '#5A5A7A'} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

            {/* ── Upload Docs tab ────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <>
                {/* Drag and drop area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragging ? '#7C3AED' : '#2A2A3D'}`,
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: isDragging ? 'rgba(124,58,237,0.06)' : 'transparent',
                    transition: 'all 0.2s',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
                  <p style={{ color: '#F0F0FF', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                    Drop files here or click to browse
                  </p>
                  <p style={{ color: '#5A5A7A', fontSize: '12px' }}>
                    Supports PDF, TXT, DOCX — files are chunked and indexed automatically
                  </p>

                  {/* Hidden file input — triggered by clicking the drop zone */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx,.doc,.md"
                    onChange={e => handleFiles(e.target.files)}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Files list */}
                {uploadedFiles.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', color: '#5A5A7A', marginBottom: '10px' }}>
                      Files ({uploadedFiles.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {uploadedFiles.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', borderRadius: '10px',
                          backgroundColor: '#1A1A2E', border: '1px solid #2A2A3D',
                        }}>
                          <FileIcon filename={f.file.name} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', color: '#F0F0FF', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.file.name}
                              </span>
                              <span style={{ fontSize: '11px', color: '#5A5A7A', flexShrink: 0, marginLeft: '8px' }}>
                                {formatSize(f.file.size)}
                              </span>
                            </div>

                            {/* Progress bar */}
                            {f.status === 'uploading' && (
                              <div style={{ height: '3px', backgroundColor: '#2A2A3D', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${f.progress}%`, backgroundColor: '#7C3AED', transition: 'width 0.3s' }} />
                              </div>
                            )}

                            {/* Status */}
                            {f.status === 'done' && (
                              <span style={{ fontSize: '11px', color: '#10B981' }}>
                                ✓ Ready — {f.chunks} chunks indexed
                              </span>
                            )}
                            {f.status === 'pending' && (
                              <span style={{ fontSize: '11px', color: '#5A5A7A' }}>
                                Queued — will upload when you save
                              </span>
                            )}
                            {f.status === 'error' && (
                              <span style={{ fontSize: '11px', color: '#EF4444' }}>
                                ✗ {f.error}
                              </span>
                            )}
                          </div>

                          {/* Status icon */}
                          <div style={{ flexShrink: 0 }}>
                            {f.status === 'pending'   && <File size={14} color="#5A5A7A" />}
                            {f.status === 'uploading' && <Loader size={14} color="#7C3AED" style={{ animation: 'spin 1s linear infinite' }} />}
                            {f.status === 'done'      && <CheckCircle size={14} color="#10B981" />}
                            {f.status === 'error'     && <AlertCircle size={14} color="#EF4444" />}
                          </div>

                          {/* Remove button — only for pending files */}
                          {f.status === 'pending' && (
                            <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                              style={{ padding: '2px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                              <X size={13} color="#5A5A7A" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadedFiles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#5A5A7A', fontSize: '13px' }}>
                    No files added yet — drag and drop above or click to browse
                  </div>
                )}
              </>
            )}

            {/* ── GitHub tab ─────────────────────────────────────────── */}
            {activeTab === 'github' && (
              <div>
                <p style={{ fontSize: '13px', color: '#8B8BB3', marginBottom: '20px' }}>
                  Connect to a GitHub repository to index its files into this knowledge base.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  {[
                    { key: 'key',     label: 'GitHub Token',      placeholder: 'ghp_xxxxxxxxxxxx' },
                    { key: 'account', label: 'GitHub Account',    placeholder: 'your-org-or-username' },
                    { key: 'repo',    label: 'Repository Name',   placeholder: 'my-repository' },
                    { key: 'branch',  label: 'Branch',            placeholder: 'main' },
                  ].map(field => (
                    <div key={field.key}>
                      <Label text={field.label} required />
                      <input
                        type={field.key === 'key' ? 'password' : 'text'}
                        value={github[field.key]}
                        onChange={e => setGithub(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = '#7C3AED'}
                        onBlur={e  => e.target.style.borderColor = '#2A2A3D'}
                      />
                    </div>
                  ))}
                </div>

                <button style={{
                  padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
                  backgroundColor: 'transparent', border: '1px solid #2A2A3D',
                  color: '#8B8BB3', fontSize: '13px',
                }}>
                  Test Connection
                </button>

                <p style={{ fontSize: '12px', color: '#5A5A7A', marginTop: '14px', padding: '10px', backgroundColor: '#1A1A2E', borderRadius: '8px', border: '1px solid #2A2A3D' }}>
                  💡 GitHub indexing is coming in a future update. For now, download files from GitHub and upload them using the Upload Docs tab.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}