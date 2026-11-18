import api from './api'

const workflowService = {

  // POST /workflows/ — save a new workflow with its canvas state
  async create(workflowData) {
    const response = await api.post('/workflows/', workflowData)
    return response.data
  },

  // GET /workflows/ — list all workflows for the user
  async list() {
    const response = await api.get('/workflows/')
    return response.data
  },

  // GET /workflows/count — for dashboard stats
  async count() {
    const response = await api.get('/workflows/count')
    return response.data
  },

  // GET /workflows/{id} — get one workflow to load its canvas
  async get(id) {
    const response = await api.get(`/workflows/${id}`)
    return response.data
  },

  // PUT /workflows/{id} — update canvas state (auto-save)
  async update(id, data) {
    const response = await api.put(`/workflows/${id}`, data)
    return response.data
  },

  // DELETE /workflows/{id}
  async remove(id) {
    await api.delete(`/workflows/${id}`)
  },

  // POST /workflows/{id}/clone — copy someone's published item (or your own) into your account
  async clone(id) {
    const response = await api.post(`/workflows/${id}/clone`)
    return response.data
  },
}

export default workflowService