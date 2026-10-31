import { useNavigate } from 'react-router-dom'
import { Bot, GitBranch, Wrench, BookOpen, Shield, ChevronRight } from 'lucide-react'

// The 5 artifact types with their icons, descriptions, and routes
const buildItems = [
  {
    icon:        Bot,
    label:       'Agent',
    description: 'An autonomous AI worker with a role, goal, and instructions',
    path:        '/build/agent',
    color:       '#7C3AED',
    bg:          'rgba(124,58,237,0.12)',
  },
  {
    icon:        GitBranch,
    label:       'Workflow',
    description: 'Connect multiple agents in sequential, parallel, or branching flows',
    path:        '/build/workflow',
    color:       '#06B6D4',
    bg:          'rgba(6,182,212,0.12)',
  },
  {
    icon:        Wrench,
    label:       'Tool',
    description: 'A Python function agents can call to interact with the real world',
    path:        '/build/tool',
    color:       '#10B981',
    bg:          'rgba(16,185,129,0.12)',
  },
  {
    icon:        BookOpen,
    label:       'Knowledge Base',
    description: 'Upload documents for agents to search and retrieve from',
    path:        '/build/kb',
    color:       '#F59E0B',
    bg:          'rgba(245,158,11,0.12)',
  },
  {
    icon:        Shield,
    label:       'Guardrail',
    description: 'Rules and policies that govern agent behaviour and outputs',
    path:        '/build/guardrail',
    color:       '#8B5CF6',
    bg:          'rgba(139,92,246,0.12)',
  },
]

export default function BuildPage() {
  const navigate = useNavigate()

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: 'var(--font-h1)', fontWeight: '700', color: '#F0F0FF', marginBottom: '6px' }}>
          Build
        </h1>
        <p style={{ color: '#8B8BB3', fontSize: '14px' }}>
          Create agents, workflows, tools, knowledge bases, and guardrails
        </p>
      </div>

      {/* Build cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {buildItems.map(({ icon: Icon, label, description, path, color, bg }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            style={{
              backgroundColor: '#13131F',
              border: '0.5px solid #2A2A3D',
              borderRadius: '16px',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = color
              e.currentTarget.style.backgroundColor = '#1A1A2E'
              e.currentTarget.style.transform = 'translateX(3px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#2A2A3D'
              e.currentTarget.style.backgroundColor = '#13131F'
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            {/* Icon box */}
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              backgroundColor: bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} color={color} />
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#F0F0FF', marginBottom: '3px' }}>
                {label}
              </div>
              <div style={{ fontSize: '13px', color: '#8B8BB3' }}>{description}</div>
            </div>

            <ChevronRight size={16} color="#5A5A7A" />
          </div>
        ))}
      </div>
    </div>
  )
}