// ── Every product name in ONE place ────────────────────────────────────────
// Rename the platform or any section here; the whole UI follows.
// (Also change <title> in frontend/index.html.)

export const APP_NAME    = 'AgentLoom'
export const APP_TAGLINE = 'Weave AI agents into workflows that do real work.'

export const LABELS = {
  // sidebar
  home:      'Home',
  studio:    'Build',       // where you create things
  gallery:   'Gallery',     // everything people have published
  activity:  'Activity',    // run history

  // things you build
  agent:      'Agent',      agents:     'Agents',
  connector:  'Connector',  connectors: 'Connectors',   // Python code that talks to an app (Azure, S3, GitHub…)
  library:    'Context Store', libraries: 'Context Stores', // documents agents search before answering (RAG)
  guardrail:  'Guardrail',  guardrails: 'Guardrails',
  workflow:   'Workflow',   workflows:  'Workflows',

  // home page sections
  startBuilding: 'Start building',
  liveActivity:  'Live activity',
}
