import api from './api'

const toolService = {

  // POST /tools/ — save a new tool with its Python code
  async create(toolData) {
    const response = await api.post('/tools/', toolData)
    return response.data
  },

  // GET /tools/ — list all tools the user created
  async list() {
    const response = await api.get('/tools/')
    return response.data
  },

  // GET /tools/count — just the number for dashboard
  async count() {
    const response = await api.get('/tools/count')
    return response.data
  },

  // GET /tools/{id} — get one tool (for editing)
  async get(id) {
    const response = await api.get(`/tools/${id}`)
    return response.data
  },

  // PUT /tools/{id} — update existing tool
  async update(id, data) {
    const response = await api.put(`/tools/${id}`, data)
    return response.data
  },

  // DELETE /tools/{id}
  async remove(id) {
    await api.delete(`/tools/${id}`)
  },
}

export default toolService