import api from './api'

const executionService = {

  // POST /executions/run/{workflow_id}   body: { user_input }
  // The input goes in the BODY, not the URL — URLs end up in server logs,
  // and the input often contains tokens.
  async run(workflowId, userInput = '') {
    const response = await api.post(`/executions/run/${workflowId}`, { user_input: userInput })
    return response.data
  },

  // POST /executions/{id}/cancel — ask a running workflow to stop
  async cancel(id) {
    const response = await api.post(`/executions/${id}/cancel`)
    return response.data
  },

  // GET /executions/ — recent executions for the dashboard
  async list(limit = 20) {
    const response = await api.get('/executions/', { params: { limit } })
    return response.data
  },

  // GET /executions/history — run summaries for the Runs page (no agent outputs)
  // status: '' | 'running' | 'completed' | 'failed' | 'cancelled,interrupted' ...
  async history({ limit = 25, offset = 0, status = '', workflowId = null } = {}) {
    const params = { limit, offset }
    if (status) params.status = status
    if (workflowId) params.workflow_id = workflowId
    const response = await api.get('/executions/history', { params })
    return response.data   // { items: [...], total }
  },

  // GET /executions/{id} — full execution with logs
  async get(id) {
    const response = await api.get(`/executions/${id}`)
    return response.data
  },

  // GET /executions/workflow/{workflow_id} — runs for a specific workflow
  async getByWorkflow(workflowId) {
    const response = await api.get(`/executions/workflow/${workflowId}`)
    return response.data
  },

  // GET /executions/{id}/stream — live events (Server-Sent Events)
  //
  // Uses fetch() instead of EventSource because EventSource cannot send the
  // Authorization header (we never put the token in the URL).
  // Calls onEvent(event) for each event. Resolves with { status } when the
  // server says the run is over, or null if the connection dropped
  // (the caller then reconnects with `after` = last event id).
  async stream(id, { after = 0, onEvent, signal }) {
    const token = localStorage.getItem('forge_token')
    const res = await fetch(`${api.defaults.baseURL}/executions/${id}/stream?after=${after}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
    if (res.status === 401) {
      localStorage.removeItem('forge_token')
      localStorage.removeItem('forge_user')
      window.location.href = '/login'
      return null
    }
    if (!res.ok || !res.body) throw new Error(`Live updates unavailable (${res.status})`)

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) return null
      buffer += decoder.decode(value, { stream: true })
      let split
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, split)
        buffer = buffer.slice(split + 2)
        let name = 'message', data = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (!data) continue                       // heartbeat / retry lines
        const payload = JSON.parse(data)
        if (name === 'end') return payload        // { status }
        onEvent(payload)
      }
    }
  },
}

export default executionService
