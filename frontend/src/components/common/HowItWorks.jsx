import { useNavigate } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { APP_NAME } from '../../config/brand'

// A picture a first-time visitor understands in 10 seconds:
// a tool brings data in → agents work on it one after another → the result goes out.
const FLOW = [
  { kind: 'TOOL',   color: '#06B6D4', icon: '🗄️', title: 'Azure Storage',   text: 'Reads the daily sales files from the cloud' },
  { kind: 'AGENT',  color: '#7C3AED', icon: '🔍', title: 'Checker agent',   text: 'Looks at the files and spots what is wrong' },
  { kind: 'AGENT',  color: '#7C3AED', icon: '🧹', title: 'Prep agent',      text: 'Cleans the data and writes a short summary' },
  { kind: 'OUTPUT', color: '#10B981', icon: '🐙', title: 'GitHub',          text: 'Saves the final report for the team' },
]

const STEPS = [
  { n: 1, title: 'Add a tool',      text: 'A tool connects to an app: cloud storage (Azure, S3), GitHub, Databricks, an API…' },
  { n: 2, title: 'Create agents',   text: 'An agent is an AI worker. Give it a role and instructions in plain English.' },
  { n: 3, title: 'Connect and run', text: 'Link agents into a workflow, press Run, and watch each one work live.' },
]

export default function HowItWorks() {
  const navigate = useNavigate()
  return (
    <div className="forge-card">
      <style>{`
        .hiw-flow  { display: flex; align-items: stretch; gap: 8px; flex-wrap: wrap; }
        .hiw-box   { flex: 1 1 150px; min-width: 150px; }
        .hiw-arrow { display: flex; align-items: center; justify-content: center; color: #5A5A7A; font-size: 20px; flex: 0 0 18px; }
        @media (max-width: 760px) {
          .hiw-flow  { flex-direction: column; }
          .hiw-box   { flex: 0 0 auto; min-width: 0; }
          .hiw-arrow { transform: rotate(90deg); height: 18px; }
        }
      `}</style>

      <div className="forge-section-header">
        <Lightbulb size={15} color="#F59E0B" />
        <span className="forge-section-title">New here? How {APP_NAME} works</span>
      </div>

      <p style={{ color: '#8B8BB3', fontSize: '13px', marginBottom: '14px', lineHeight: 1.6 }}>
        A <b style={{ color: '#F0F0FF' }}>workflow</b> is a small team of AI agents passing work along, like an assembly line.
        For example, a daily data check:
      </p>

      {/* The picture */}
      <div className="hiw-flow" style={{ backgroundColor: '#0D0D18', border: '1px solid #2A2A3D', borderRadius: '14px', padding: '16px' }}>
        {FLOW.map((b, i) => (
          <div key={b.title} style={{ display: 'contents' }}>
            <div className="hiw-box" style={{
              backgroundColor: '#1A1A2E', border: `1px solid ${b.color}55`, borderRadius: '12px',
              padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              <span style={{
                alignSelf: 'flex-start', fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                color: b.color, backgroundColor: `${b.color}1A`, border: `1px solid ${b.color}40`,
                padding: '2px 6px', borderRadius: '4px',
              }}>{b.kind}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{b.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0FF' }}>{b.title}</span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#8B8BB3', lineHeight: 1.5 }}>{b.text}</span>
            </div>
            {i < FLOW.length - 1 && <div className="hiw-arrow" aria-hidden="true">→</div>}
          </div>
        ))}
      </div>

      {/* Three steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '14px' }}>
        {STEPS.map(s => (
          <div key={s.n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'rgba(124,58,237,0.18)', color: '#A78BFA',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700,
            }}>{s.n}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F0F0FF' }}>{s.title}</div>
              <div style={{ fontSize: '12px', color: '#8B8BB3', lineHeight: 1.5 }}>{s.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/build/tool')} style={{
          padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
          color: 'white', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
        }}>Start with a tool</button>
        <button onClick={() => navigate('/discover')} style={{
          padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
          color: '#A78BFA', backgroundColor: 'transparent', border: '1px solid #2A2A3D',
        }}>See what others built</button>
      </div>
    </div>
  )
}
