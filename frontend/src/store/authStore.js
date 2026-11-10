import { create } from 'zustand'

// create() defines the store
// (set) is the function you call to update the store
// Every component that calls useAuthStore() gets access to everything here
// Read the saved login from localStorage.
// This runs when the store is CREATED — before React draws anything — so
// ProtectedRoute sees isLoggedIn = true on the very first render.
// (Restoring it later in a useEffect was too late: the first render had already
// redirected to /login, which logged you out on every refresh / new tab.)
function loadSavedLogin() {
  try {
    const token = localStorage.getItem('forge_token')
    const user  = JSON.parse(localStorage.getItem('forge_user') || 'null')
    if (token && user) return { user, token, isLoggedIn: true }
  } catch {
    localStorage.removeItem('forge_token')
    localStorage.removeItem('forge_user')
  }
  return { user: null, token: null, isLoggedIn: false }
}

const useAuthStore = create((set) => ({

  // ── State (restored immediately from localStorage) ─────
  // user: { id, email, full_name } | token: the JWT string | isLoggedIn: boolean
  ...loadSavedLogin(),

  // ── Actions (functions that update the state) ──────────

  // Called after successful login or register
  // Saves to state AND to localStorage (so login persists after browser refresh)
  login: (user, token) => {
    localStorage.setItem('forge_token', token)
    localStorage.setItem('forge_user', JSON.stringify(user))
    set({ user, token, isLoggedIn: true })
  },

  // Called when user clicks logout
  // Clears state AND localStorage
  logout: () => {
    localStorage.removeItem('forge_token')
    localStorage.removeItem('forge_user')
    set({ user: null, token: null, isLoggedIn: false })
  },

  // Called ONCE when the app first loads
  // Checks localStorage to restore login state if the user was previously logged in
  // This is why you stay logged in after closing and reopening the browser
  // (kept so App.jsx's init() call still works — the state is already restored above)
  init: () => set(loadSavedLogin()),
}))

export default useAuthStore