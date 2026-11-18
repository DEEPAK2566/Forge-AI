import api from './api'

/**
 * All agent-related API calls in one place.
 * Components import from here — they never call axios/api directly.
 * This makes it easy to change the API without updating every component.
 */
const agentService = {

  // POST /agents/ — save a new agent to the database
  async create(agentData) {
    const response = await api.post('/agents/', agentData)
    return response.data
  },

  // GET /agents/ — get all agents for the logged-in user
  async list() {
    const response = await api.get('/agents/')
    return response.data
  },

  // GET /agents/count — just the number, for dashboard stats
  async count() {
    const response = await api.get('/agents/count')
    return response.data  // returns { count: 3 }
  },

  // GET /agents/{id} — get one agent by its ID
  async get(id) {
    const response = await api.get(`/agents/${id}`)
    return response.data
  },

  // PUT /agents/{id} — update an existing agent
  async update(id, data) {
    const response = await api.put(`/agents/${id}`, data)
    return response.data
  },

  // DELETE /agents/{id} — remove an agent permanently
  async remove(id) {
    await api.delete(`/agents/${id}`)
  },

  // POST /agents/{id}/clone — copy someone's published item (or your own) into your account
  async clone(id) {
    const response = await api.post(`/agents/${id}/clone`)
    return response.data
  },
}

export default agentService