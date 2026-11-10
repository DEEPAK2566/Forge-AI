import { useState, useEffect } from 'react'
import { X, Play, Loader, Info } from 'lucide-react'
import agentService from '../../services/agentService'

// Regex to find {{ variable_name }} patterns anywhere in text
const VAR_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g

export default function RunWorkflowModal({ nodes, workflowName, onConfirm, onCancel }) {
  // step: 'loading' while fetching agents | 'variables' if {{ }} found | 'simple' otherwise
  const [step,         setStep]         = useState('loading')
  const [variables,    setVariables]    = useState([])   // [{ name, agentName }]
  const [values,       setValues]       = useState({})   // { var_name: '' }
  const [simpleInput,  setSimpleInput]  = useState('Analyze and summarize the situation.')
  const [error,        setError]        = useState('')

  // On mount: fetch all agents in this workflow and parse {{ }} patterns
  useEffect(() => {
    const parse = async () => {
      const found = new Map()  // varName -> first agent name where it was found

      for (const node of nodes) {
        const agentId = node.data?.agent_id
        if (!agentId) continue
        try {
          const agent = await agentService.get(agentId)
          // Check all text fields of the agent for {{ variable }} patterns
          const text = [
            agent.description || '',
            agent.goal        || '',
            agent.role        || '',
            agent.backstory   || '',
          ].join('\n')

          let match
          VAR_PATTERN.lastIndex = 0  // reset regex state
          while ((match = VAR_PATTERN.exec(text)) !== null) {
            const varName = match[1].trim()
            if (!found.has(varName)) {
              found.set(varName, agent.name)
            }
          }
        } catch (e) {
          // Agent might not exist — skip silently
        }
      }

      const varList = Array.from(found.entries()).map(([name, agentName]) => ({
        name,
        agentName,
      }))

      setVariables(varList)

      // Initialize all values to empty string
      const init = {}
      varList.forEach(v => { init[v.name] = '' })
      setValues(init)

      setStep(varList.length > 0 ? 'variables' : 'simple')
    }

    parse()
  }, [])

  const handleRun = () => {
    if (step === 'variables') {
      const empty = variables.filter(v => !values[v.name]?.trim())
      if (empty.length > 0) {
        setError(`Please fill in: ${empty.map(v => v.name).join(', ')}`)
        return
      }
      // Strip whitespace and newlines from every value before sending
      const cleanValues = {}
      Object.entries(values).forEach(([k, v]) => {
        cleanValues[k] = v.trim()
      })
      onConfirm(JSON.stringify(cleanValues))
    } else {
      onConfirm(simpleInput.trim() || 'Begin.')
    }
  }

  const inputStyle = {
    width:           '100%',
    backgroundColor: '#0D0D14',
    border:          '1px solid #2A2A3D',
    borderRadius:    '8px',
    padding:         '9px 12px',
    color:           '#F0F0FF',
    fontSize:        '13px',
  }

  return (
    // Backdrop — clicking outside cancels
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position:        'fixed',
        inset:           0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          1000,
        padding:         '24px',
      }}
    >
      <div style={{
        backgroundColor: '#13131F',
        border:          '1px solid #2A2A3D',
        borderRadius:    '20px',
        width:           '100%',
        maxWidth:        '520px',
        maxHeight:       '80vh',
        overflow:        'hidden',
        display:         'flex',
        flexDirection:   'column',
      }}>
        {/* Header */}
        <div style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '18px 24px',
          borderBottom:    '1px solid #2A2A3D',
          backgroundColor: '#1A1A2E',
          flexShrink:      0,
        }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#F0F0FF', marginBottom: '2px' }}>
              ▶ Run Workflow
            </h2>
            <p style={{ fontSize: '12px', color: '#5A5A7A' }}>{workflowName}</p>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="#5A5A7A" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#5A5A7A' }}>
              <Loader size={20} color="#7C3AED" style={{ animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
              <p style={{ fontSize: '13px' }}>Detecting input variables from agents...</p>
            </div>
          )}

          {step === 'variables' && (
            <>
              {/* Info banner explaining {{ }} system */}
              <div style={{
                display:         'flex',
                gap:             '10px',
                padding:         '10px 14px',
                backgroundColor: 'rgba(124,58,237,0.08)',
                border:          '1px solid rgba(124,58,237,0.2)',
                borderRadius:    '10px',
                marginBottom:    '20px',
              }}>
                <Info size={14} color="#7C3AED" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '12px', color: '#8B8BB3', lineHeight: '1.55' }}>
                  These input fields were detected from <span style={{ color: '#7C3AED' }}>{'{{ variable }}'}</span> placeholders
                  in your agent descriptions. Fill them in and they will be injected into each agent automatically.
                </p>
              </div>

              {/* One input per detected variable */}
              {variables.map(v => (
                <div key={v.name} style={{ marginBottom: '16px' }}>
                  <label style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            '8px',
                    fontSize:       '13px',
                    fontWeight:     '500',
                    color:          '#F0F0FF',
                    marginBottom:   '6px',
                  }}>
                    <code style={{
                      backgroundColor: 'rgba(124,58,237,0.12)',
                      color:           '#A78BFA',
                      padding:         '2px 7px',
                      borderRadius:    '5px',
                      fontSize:        '12px',
                    }}>
                      {`{{ ${v.name} }}`}
                    </code>
                    <span style={{ fontSize: '11px', color: '#5A5A7A', fontWeight: '400' }}>
                      — used in: {v.agentName}
                    </span>
                  </label>
                  {/token|password|secret|api_?key|credential/i.test(v.name) ? (
                    // Credentials: masked, never shown on screen
                    <input
                      type="password"
                      autoComplete="off"
                      value={values[v.name] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                      placeholder={`Enter ${v.name} (hidden)`}
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#7C3AED'}
                      onBlur={e  => e.target.style.borderColor = '#2A2A3D'}
                    />
                  ) : (
                    <textarea
                      value={values[v.name] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                      placeholder={`Enter value for ${v.name}...`}
                      rows={v.name.toLowerCase().includes('input') || v.name.toLowerCase().includes('content') ? 4 : 2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      onFocus={e => e.target.style.borderColor = '#7C3AED'}
                      onBlur={e  => e.target.style.borderColor = '#2A2A3D'}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {step === 'simple' && (
            <>
              <p style={{ fontSize: '13px', color: '#8B8BB3', marginBottom: '16px', lineHeight: '1.55' }}>
                Enter the initial input for this workflow. This text is sent to the first agent.
                You can use <code style={{ backgroundColor: 'rgba(124,58,237,0.12)', color: '#A78BFA', padding: '1px 5px', borderRadius: '4px' }}>{'{{ variable_name }}'}</code> in your agent descriptions for dynamic inputs.
              </p>
              <textarea
                value={simpleInput}
                onChange={e => setSimpleInput(e.target.value)}
                rows={4}
                placeholder="Analyze and summarize the situation."
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e  => e.target.style.borderColor = '#2A2A3D'}
                autoFocus
              />
            </>
          )}

          {error && (
            <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '10px' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        {step !== 'loading' && (
          <div style={{
            display:         'flex',
            justifyContent:  'flex-end',
            gap:             '10px',
            padding:         '16px 24px',
            borderTop:       '1px solid #2A2A3D',
            backgroundColor: '#1A1A2E',
            flexShrink:      0,
          }}>
            <button onClick={onCancel} style={{
              padding:         '8px 18px',
              borderRadius:    '9px',
              cursor:          'pointer',
              backgroundColor: 'transparent',
              border:          '1px solid #2A2A3D',
              color:           '#8B8BB3',
              fontSize:        '13px',
            }}>
              Cancel
            </button>
            <button onClick={handleRun} style={{
              padding:         '8px 20px',
              borderRadius:    '9px',
              cursor:          'pointer',
              background:      'linear-gradient(135deg, #10B981, #059669)',
              border:          'none',
              color:           'white',
              fontSize:        '13px',
              fontWeight:      '600',
              display:         'flex',
              alignItems:      'center',
              gap:             '6px',
              boxShadow:       '0 0 16px rgba(16,185,129,0.3)',
            }}>
              <Play size={13} fill="white" /> Run Workflow
            </button>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}