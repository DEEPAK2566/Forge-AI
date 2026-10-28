import api from './api'

const kbService = {

  // POST /knowledge-bases/ — create a KB record
  async create(kbData) {
    const response = await api.post('/knowledge-bases/', kbData)
    return response.data
  },

  // POST /knowledge-bases/{id}/upload — upload a file
  // File uploads need FormData (not JSON)
  async uploadFile(kbId, file, onProgress) {
    const formData = new FormData()
    formData.append('file', file)  // 'file' must match the FastAPI parameter name

    const response = await api.post(
      `/knowledge-bases/${kbId}/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        // onUploadProgress: shows upload percentage
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total))
          }
        },
      }
    )
    return response.data
  },

  async list() {
    const response = await api.get('/knowledge-bases/')
    return response.data
  },

  async count() {
    const response = await api.get('/knowledge-bases/count')
    return response.data
  },

  async get(id) {
    const response = await api.get(`/knowledge-bases/${id}`)
    return response.data
  },

  async remove(id) {
    await api.delete(`/knowledge-bases/${id}`)
  },
}

export default kbService