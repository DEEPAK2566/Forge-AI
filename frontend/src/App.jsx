import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'

import Layout          from './components/common/Layout'
import ProtectedRoute  from './components/common/ProtectedRoute'

import MySpace          from './pages/Myspace'
import Login            from './pages/auth/login'
import Register         from './pages/auth/Register'
import AgentBuilder     from './pages/Build/AgentBuilder'
import ToolBuilder      from './pages/Build/ToolBuilder'
import KBBuilder        from './pages/Build/KBBuilder'
import WorkflowBuilder  from './pages/Build/WorkflowBuilder'
import GuardrailBuilder from './pages/Build/GuardrailBuilder'
import ExecutionMonitor from './pages/Executions/ExecutionMonitor'
import Discover         from './pages/Discover'
import BuildHome        from './pages/Build/index'

import useAuthStore from './store/authStore'

function App() {
  const init = useAuthStore(state => state.init)
  useEffect(() => { init() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />}    />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/myspace" replace />} />
          <Route path="myspace"               element={<MySpace />}          />
          <Route path="discover"              element={<Discover />}         />
          <Route path="build"                 element={<BuildHome />}        />
          <Route path="build/agent"           element={<AgentBuilder />}     />
          <Route path="build/agent/:agentId"  element={<AgentBuilder />}     />
          <Route path="build/tool"            element={<ToolBuilder />}      />
          <Route path="build/tool/:toolId"  element={<ToolBuilder />}  />
          <Route path="build/kb"              element={<KBBuilder />}        />
          <Route path="build/workflow"        element={<WorkflowBuilder />}  />
          <Route path="build/guardrail"       element={<GuardrailBuilder />} />
          <Route path="executions/:executionId" element={<ExecutionMonitor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App