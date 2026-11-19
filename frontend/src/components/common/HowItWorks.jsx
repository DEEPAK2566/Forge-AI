import { useNavigate } from 'react-router-dom'
import { APP_NAME, APP_TAGLINE, LABELS } from '../../config/brand'

/*
  The first thing a visitor sees on Home: a small workflow that "runs" by itself.

     Azure ── Agent 1 · reads orders ─────┐
                                          ├── Agent 3 · combines ── GitHub agent ── report.md
     S3 ───── Agent 2 · reads customers ──┘

  Agents 1 and 2 run IN PARALLEL (they start together), Agent 3 waits for both (merge),
  then the GitHub agent publishes. A glowing dot travels along each line; an agent lights up
  while it works and shows a tick when done. One 9-second loop. People who turn off
  animations (prefers-reduced-motion) see the finished picture without movement.
*/

const CSS = `
.loom { position: relative; overflow: hidden; border-radius: 20px; border: 1px solid #2A2A3D;
        background:
          radial-gradient(700px 260px at 85% -10%, rgba(124,58,237,0.22), transparent 60%),
          radial-gradient(500px 220px at -5% 110%, rgba(6,182,212,0.14), transparent 60%),
          #12121D;
        padding: 28px 28px 22px; }
.loom-top { display: flex; gap: 24px; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; }
.loom-hello { font-size: 13px; color: #8B8BB3; margin-bottom: 6px; }
.loom-title { font-family: 'Sora', 'Inter', sans-serif; font-weight: 700; color: #F4F3FF;
              font-size: clamp(22px, 2.6vw, 32px); line-height: 1.15; letter-spacing: -0.02em; max-width: 620px; }
.loom-sub { color: #9C9CC2; font-size: 14px; margin-top: 8px; max-width: 560px; line-height: 1.55; }
.loom-cta { display: flex; gap: 10px; flex-wrap: wrap; }
.loom-btn { padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
.loom-btn.primary { color: #fff; background: linear-gradient(135deg, #7C3AED, #6D28D9); box-shadow: 0 6px 24px rgba(124,58,237,0.35); }
.loom-btn.ghost   { color: #C4B5FD; background: transparent; border: 1px solid #3A3A55; }
.loom-btn:focus-visible { outline: 2px solid #A78BFA; outline-offset: 2px; }

/* the workflow frame */
.loom-frame { margin-top: 22px; border: 1px dashed #3A3A55; border-radius: 16px; padding: 14px 16px 16px; background: rgba(13,13,22,0.55); }
.loom-frame-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 12px; color: #8B8BB3; }
.loom-tag { padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600;
            color: #C4B5FD; background: rgba(124,58,237,0.16); border: 1px solid rgba(124,58,237,0.35); }
.loom-status { margin-left: auto; position: relative; width: 84px; height: 20px; }
.loom-status span { position: absolute; right: 0; top: 0; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; }
.loom-status .run { color: #22D3EE; animation: loom-run 9s infinite; }
.loom-status .ok  { color: #34D399; opacity: 0; animation: loom-ok 9s infinite; }
.loom-status .run i { width: 7px; height: 7px; border-radius: 50%; background: #22D3EE; box-shadow: 0 0 8px #22D3EE; }

/* layout: [two parallel lanes] [join] [Agent 3] — [GitHub agent] — [report] */
.loom-flow { display: flex; align-items: center; }
.loom-lanes { flex: 1.35 1 0; min-width: 0; position: relative; }
.loom-lanes-label { position: absolute; top: -2px; left: 92px; font-size: 10.5px; font-weight: 600; color: #22D3EE;
                    display: flex; align-items: center; gap: 5px; }
.loom-lane { display: flex; align-items: center; padding: 14px 0 6px; }
.loom-join { flex: 0 0 46px; align-self: stretch; }
.loom-join svg { width: 100%; height: 100%; display: block; overflow: visible; }
.loom-join path { fill: none; stroke: #3A3A5C; stroke-width: 2; vector-effect: non-scaling-stroke; animation: loom-joinglow 9s infinite; }

.loom-chip { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 56px; }
.loom-chip-box { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
                 font-size: 22px; background: #1B1B2C; border: 1px solid #34345A; }
.loom-chip small { font-size: 10.5px; color: #8B8BB3; }
.loom-report .loom-chip-box { animation: loom-report 9s infinite; }

.loom-node { flex: 1 1 0; min-width: 0; border-radius: 14px; padding: 11px 12px 10px; background: #1A1A2B; border: 1px solid #2E2E48; }
.loom-node-head { display: flex; align-items: center; gap: 9px; }
.loom-node-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.loom-node-title { font-size: 13px; font-weight: 600; color: #F0F0FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.loom-node-job { font-size: 11.5px; color: #8B8BB3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.loom-node-done { margin-top: 8px; font-size: 11px; font-weight: 600; color: #34D399; display: flex; align-items: center; gap: 5px; opacity: 0;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.loom-node-done b { width: 15px; height: 15px; border-radius: 50%; background: rgba(52,211,153,0.18); display: inline-flex;
                    align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }

/* ONE line between steps, with a glowing dot that travels along it */
.loom-line { flex: 0 0 36px; height: 2px; position: relative; margin: 0 2px; border-radius: 2px;
             background: linear-gradient(90deg, #7C3AED, #06B6D4); }
.loom-dot { position: absolute; top: -4px; left: 0; width: 10px; height: 10px; border-radius: 50%;
            background: #fff; box-shadow: 0 0 10px 3px rgba(167,139,250,0.9); opacity: 0; }

.loom-legend { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 16px; font-size: 12px; color: #9C9CC2; }
.loom-legend span { display: flex; align-items: center; gap: 7px; }
.loom-legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }

/* ── the 9 s run ──────────────────────────────────────────────
   0–8%   data flows into Agents 1 and 2 (both lines at once)
   8–26%  Agents 1 and 2 work in parallel
   26–33% the two results join
   33–50% Agent 3 combines them
   50–58% → GitHub agent, 58–72% publishes
   72–79% → report.md appears, hold, reset */
.in .loom-dot  { animation: loom-in 9s infinite; }
.to-gh .loom-dot { animation: loom-togh 9s infinite; }
.to-rep .loom-dot { animation: loom-torep 9s infinite; }
.n1, .n2 { animation: loom-par 9s infinite; }  .n1 .loom-node-done, .n2 .loom-node-done { animation: loom-dpar 9s infinite; }
.n3 { animation: loom-n3 9s infinite; }        .n3 .loom-node-done { animation: loom-d3 9s infinite; }
.n4 { animation: loom-n4 9s infinite; }        .n4 .loom-node-done { animation: loom-d4 9s infinite; }

@keyframes loom-in    { 0% { left: 0; opacity: 1 } 8% { left: calc(100% - 10px); opacity: 1 } 9%, 100% { opacity: 0 } }
@keyframes loom-togh  { 0%, 49% { left: 0; opacity: 0 } 50% { opacity: 1 } 58% { left: calc(100% - 10px); opacity: 1 } 59%, 100% { opacity: 0 } }
@keyframes loom-torep { 0%, 71% { left: 0; opacity: 0 } 72% { opacity: 1 } 79% { left: calc(100% - 10px); opacity: 1 } 80%, 100% { opacity: 0 } }
@keyframes loom-joinglow { 0%, 25% { stroke: #3A3A5C } 27%, 33% { stroke: #A78BFA; filter: drop-shadow(0 0 4px #A78BFA) } 36%, 100% { stroke: #3A3A5C; filter: none } }

@keyframes loom-par { 0%, 7% { border-color: #2E2E48; box-shadow: none }
                      9%, 24% { border-color: #22D3EE; box-shadow: 0 0 0 1px #22D3EE, 0 0 24px rgba(34,211,238,0.4) }
                      27%, 92% { border-color: rgba(52,211,153,0.5); box-shadow: none } 97%, 100% { border-color: #2E2E48 } }
@keyframes loom-n3  { 0%, 32% { border-color: #2E2E48; box-shadow: none }
                      34%, 48% { border-color: #A78BFA; box-shadow: 0 0 0 1px #A78BFA, 0 0 26px rgba(167,139,250,0.45) }
                      51%, 92% { border-color: rgba(52,211,153,0.5); box-shadow: none } 97%, 100% { border-color: #2E2E48 } }
@keyframes loom-n4  { 0%, 57% { border-color: #2E2E48; box-shadow: none }
                      59%, 70% { border-color: #34D399; box-shadow: 0 0 0 1px #34D399, 0 0 26px rgba(52,211,153,0.4) }
                      73%, 92% { border-color: rgba(52,211,153,0.5); box-shadow: none } 97%, 100% { border-color: #2E2E48 } }
@keyframes loom-dpar { 0%, 25% { opacity: 0; transform: translateY(3px) } 27%, 92% { opacity: 1; transform: none } 97%, 100% { opacity: 0 } }
@keyframes loom-d3   { 0%, 49% { opacity: 0; transform: translateY(3px) } 51%, 92% { opacity: 1; transform: none } 97%, 100% { opacity: 0 } }
@keyframes loom-d4   { 0%, 71% { opacity: 0; transform: translateY(3px) } 73%, 92% { opacity: 1; transform: none } 97%, 100% { opacity: 0 } }
@keyframes loom-report { 0%, 79% { opacity: 0.35; transform: scale(0.92) } 82% { opacity: 1; transform: scale(1.08); box-shadow: 0 0 22px rgba(52,211,153,0.5) }
                         85%, 92% { opacity: 1; transform: none; box-shadow: none } 97%, 100% { opacity: 0.35 } }
@keyframes loom-run { 0%, 79% { opacity: 1 } 81%, 96% { opacity: 0 } 100% { opacity: 1 } }
@keyframes loom-ok  { 0%, 79% { opacity: 0 } 81%, 96% { opacity: 1 } 100% { opacity: 0 } }

/* phones: everything stacks; lines become short vertical lines */
@media (max-width: 760px) {
  .loom { padding: 20px 16px 18px; }
  .loom-flow { flex-direction: column; align-items: stretch; }
  .loom-lanes-label { position: static; margin-bottom: 2px; }
  .loom-lane { padding: 6px 0; }
  .loom-lane .loom-line { flex: 0 0 18px; }
  .loom-join { flex: 0 0 22px; align-self: center; width: 2px; background: linear-gradient(#7C3AED, #06B6D4); }
  .loom-join svg { display: none; }
  .loom-flow > .loom-line { flex: 0 0 22px; width: 2px; height: 22px; margin: 2px auto; background: linear-gradient(#7C3AED, #06B6D4); }
  .loom-dot { display: none; }
  .loom-node { flex: 0 0 auto; }
  .loom-lane .loom-node { flex: 1 1 0; }
  .loom-report { flex-direction: row; justify-content: center; gap: 10px; width: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .loom *, .loom { animation: none !important; }
  .loom-node-done { opacity: 1; }
  .loom-node { border-color: rgba(52,211,153,0.5); }
  .loom-status .run { opacity: 0; } .loom-status .ok { opacity: 1; }
  .loom-report .loom-chip-box { opacity: 1; }
}
`

function Line({ step }) {
  return <div className={`loom-line ${step}`} aria-hidden="true"><span className="loom-dot" /></div>
}

function Node({ n, icon, color, title, job, done }) {
  return (
    <div className={`loom-node ${n}`}>
      <div className="loom-node-head">
        <div className="loom-node-icon" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div className="loom-node-title">{title}</div>
          <div className="loom-node-job">{job}</div>
        </div>
      </div>
      <div className="loom-node-done"><b>✓</b>{done}</div>
    </div>
  )
}

function Source({ icon, label }) {
  return (
    <div className="loom-chip" title={`${LABELS.connector}: brings data in`}>
      <div className="loom-chip-box">{icon}</div>
      <small>{label}</small>
    </div>
  )
}

export default function HowItWorks({ greeting, firstName }) {
  const navigate = useNavigate()
  return (
    <section className="loom" aria-label={`How ${APP_NAME} works`}>
      <style>{CSS}</style>

      <div className="loom-top">
        <div>
          {firstName && <div className="loom-hello">{greeting}, {firstName}</div>}
          <h1 className="loom-title">{APP_TAGLINE}</h1>
          <p className="loom-sub">
            Each agent does one job. Link them into a {LABELS.workflow.toLowerCase()}: some run at the same time,
            others wait for them. Press Run and watch the work flow, like this:
          </p>
        </div>
        <div className="loom-cta">
          <button className="loom-btn primary" onClick={() => navigate('/build/agent')}>Create an agent</button>
          <button className="loom-btn ghost" onClick={() => navigate('/discover')}>Browse the {LABELS.gallery.toLowerCase()}</button>
        </div>
      </div>

      {/* the living picture */}
      <div className="loom-frame">
        <div className="loom-frame-head">
          <span className="loom-tag">{LABELS.workflow}</span>
          <span style={{ color: '#D4D4F0', fontWeight: 600 }}>Daily sales report</span>
          <div className="loom-status" aria-hidden="true">
            <span className="run"><i /> Running</span>
            <span className="ok">✓ Finished</span>
          </div>
        </div>

        <div className="loom-flow">
          {/* two agents that run at the same time */}
          <div className="loom-lanes">
            <div className="loom-lanes-label">⇉ These two run in parallel</div>
            <div className="loom-lane">
              <Source icon="🗄️" label="Azure" />
              <Line step="in" />
              <Node n="n1" icon="🤖" color="#22D3EE" title="Agent 1" job="Reads the orders"    done="204 orders" />
            </div>
            <div className="loom-lane">
              <Source icon="🪣" label="S3" />
              <Line step="in" />
              <Node n="n2" icon="🤖" color="#22D3EE" title="Agent 2" job="Reads the customers" done="61 customers" />
            </div>
          </div>

          {/* the two results join here */}
          <div className="loom-join" aria-hidden="true">
            <svg viewBox="0 0 46 100" preserveAspectRatio="none">
              <path d="M0,27 C24,27 22,50 46,50" />
              <path d="M0,77 C24,77 22,50 46,50" />
            </svg>
          </div>

          <Node n="n3" icon="🧹" color="#A78BFA" title="Agent 3" job="Combines and cleans" done="Sales per city" />
          <Line step="to-gh" />
          <Node n="n4" icon="🐙" color="#34D399" title="GitHub agent" job="Publishes the report" done="Saved to GitHub" />
          <Line step="to-rep" />
          <div className="loom-chip loom-report" title="The result">
            <div className="loom-chip-box">📄</div>
            <small>report.md</small>
          </div>
        </div>
      </div>

      <div className="loom-legend">
        <span><i style={{ background: '#64748B' }} />{LABELS.connectors} bring data in</span>
        <span><i style={{ background: '#22D3EE' }} />Agents side by side run at the same time</span>
        <span><i style={{ background: '#A78BFA' }} />An agent with two inputs waits for both</span>
      </div>
    </section>
  )
}
