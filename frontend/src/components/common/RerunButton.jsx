import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import RunWorkflowModal from './RunWorkflowModal'
import workflowService from '../../services/workflowService'
import executionService from '../../services/executionService'

// "Re-run" for a finished execution: opens the Run window pre-filled with that
// run's inputs (tokens were never stored, so those are asked for again), then
// starts a new run of the same workflow and opens its monitor.
//
// Used on the Runs page and in the Execution Monitor header.
export default function RerunButton({ execution, compact = false }) {
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState(null)   // loaded when the button is clicked
  const [busy,     setBusy]     = useState(false)

  const open = async (e) => {
    e.stopPropagation()
    if (!execution?.workflow_id) {
      alert('This run is not linked to a workflow any more.')
      return
    }
    setBusy(true)
    try {
      setWorkflow(await workflowService.get(execution.workflow_id))
    } catch {
      alert('Could not load the workflow. It may have been deleted.')
    } finally {
      setBusy(false)
    }
  }

  const start = async (input) => {
    const wf = workflow
    setWorkflow(null)
    try {
      const run = await executionService.run(wf.id, input)
      navigate(`/executions/${run.id}`)
    } catch {
      alert('Could not start the run. Please try again.')
    }
  }

  return (
    <>
      <button
        onClick={open}
        disabled={busy}
        title="Run this workflow again with the same inputs"
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: compact ? '5px 9px' : '6px 12px', borderRadius: '8px',
          fontSize: compact ? '11px' : '12px', fontWeight: 500, cursor: busy ? 'default' : 'pointer',
          backgroundColor: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA',
          opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        <RotateCcw size={compact ? 11 : 12} /> {busy ? 'Loading…' : 'Re-run'}
      </button>

      {workflow && (
        <RunWorkflowModal
          nodes={workflow.nodes || []}
          workflowName={workflow.name}
          initialInput={execution.user_input || ''}
          onCancel={() => setWorkflow(null)}
          onConfirm={start}
        />
      )}
    </>
  )
}
