import { useNavigate } from 'react-router-dom'
import { Bot, GitBranch, Plug, BookOpen, Shield, ChevronRight } from 'lucide-react'
import { LABELS } from '../../config/brand'

// The 5 artifact types with their icons, descriptions, and routes
const buildItems = [
  {
    icon:        Bot,
    label:       LABELS.agent,
    description: 'An AI worker with a role, a goal and instructions',
    path:        '/build/agent',
    color:       '#7C3AED',
    bg:          'rgba(124,58,237,0.12)',
  },
  {
    icon:        GitBranch,
    label:       LABELS.workflow,
    description: 'Link agents so they hand work to each other: in order, in parallel, or by condition',
    path:        '/build/workflow',
    color:       '#06B6D4',
    bg:          'rgba(6,182,212,0.12)',
  },
  {
    icon:        Plug,
    label:       LABELS.connector,
    description: 'Python code an agent can call to reach an app: Azure, S3, GitHub, Databricks, any API',
    path:        '/build/tool',
    color:       '#10B981',
    bg:          'rgba(16,185,129,0.12)',
  },
  {
    icon:        BookOpen,
    label:       LABELS.library,
    description: 'Upload documents (rules, manuals, specs) that agents search before they answer',
    path:        '/build/kb',
    color:       '#F59E0B',
    bg:          'rgba(245,158,11,0.12)',
  },
  {
    icon:        Shield,
    label:       LABELS.guardrail,
    description: 'Rules every agent that uses it must follow, checked on every answer',
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
          {LABELS.studio}
        </h1>
        <p style={{ color: '#8B8BB3', fontSize: '14px' }}>
          Create agents, workflows, connectors, context stores and guardrails
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