import './style.css'

import { runAG00 } from './agents/ag00-validate.js'
import { runAG01 } from './agents/ag01-topology.js'
import { runAG11 } from './agents/ag11-pump-spec.js'
import { runAG12 } from './agents/ag12-maintenance-room.js'
import { runAG21 } from './agents/ag21-pool-depth.js'
import { runAG31 } from './agents/ag31-drawing.js'
import { runAG41 } from './agents/ag41-building-layout.js'
import { runAG42 } from './agents/ag42-layout-eval.js'

import { renderAG00, renderAG01, renderAG11, renderAG12, renderAG21 } from './ui/results-panel.js'
import { renderLayoutPanel } from './ui/layout-panel.js'
import { initTopologyEditor, setTopologyFromN, getCurrentTopology } from './ui/topology-editor.js'

let _lastTopoN = null

// ── Main calculation controller ───────────────────────────────────

function runCalculation() {
  const Q        = parseFloat(document.getElementById('inp-Q').value)
  const N        = parseInt(document.getElementById('inp-N').value, 10)
  const S        = parseFloat(document.getElementById('inp-S').value)
  const h_outlet = parseFloat(document.getElementById('inp-h-outlet').value)
  const pipe_len = parseFloat(document.getElementById('inp-pipe-len').value)
  const hOut     = isNaN(h_outlet) ? 1.0 : h_outlet
  const pLen     = isNaN(pipe_len) ? 50  : pipe_len

  // AG0-0: validate
  const ag00 = runAG00(Q, N, S)
  document.getElementById('card-ag00').innerHTML = renderAG00(ag00)

  const panel = document.getElementById('results-panel')
  panel.hidden = false

  // AG0-1: 若 N 变化则重置默认拓扑（不覆盖用户已编辑的拓扑）
  if (N !== _lastTopoN) {
    setTopologyFromN(N)
    _lastTopoN = N
  }

  // AG0-1: 拓扑解析
  const ag01 = runAG01(getCurrentTopology())
  document.getElementById('card-ag01').innerHTML = renderAG01(ag01)

  if (!ag00.valid) {
    ;['card-ag11', 'card-ag12', 'card-ag21'].forEach(id => {
      document.getElementById(id).innerHTML =
        '<p style="color:#999;padding:8px">参数验证未通过，无法计算。</p>'
    })
    document.getElementById('card-ag41-wrap').hidden = true
    panel.scrollIntoView({ behavior: 'smooth' })
    return
  }

  // AG2-1: pool depth (provides h_pool for AG1-1 head calculation)
  const ag21 = runAG21(Q / N, N, S)
  document.getElementById('card-ag21').innerHTML = renderAG21(ag21)

  // AG1-1: single pump spec
  const ag11 = runAG11(Q, N, ag21.h_pool, hOut, pLen)
  document.getElementById('card-ag11').innerHTML = renderAG11(ag11)

  // AG1-2: maintenance room dimensions
  const motorOverride  = parseFloat(document.getElementById('inp-motor').value)
  const effectiveMotor = isNaN(motorOverride) ? ag11.P_motor : motorOverride
  const ag12 = runAG12(N, effectiveMotor)
  ag12.DN_label = ag11.DN_outlet
  document.getElementById('card-ag12').innerHTML = renderAG12(ag12)

  // AG3-1: pump-room SVG (plan + section)，从 ag01 取拓扑（单向数据流）
  runAG31(N, ag12, ag21, S, ag01.topology)

  // AG4-1: building layout generation → AG4-2: evaluation & scoring
  const ag41Variants = runAG41()
  const ag42Variants = runAG42(ag41Variants)
  renderLayoutPanel(ag42Variants)

  panel.scrollIntoView({ behavior: 'smooth' })
}

// ── Event wiring ──────────────────────────────────────────────────

// ── 初始化 AG0-1 拓扑编辑器 ──────────────────────────────────────────
const _initN = parseInt(document.getElementById('inp-N').value, 10) || 3
initTopologyEditor('topology-editor-wrap', () => {})
setTopologyFromN(_initN)
_lastTopoN = _initN

document.getElementById('inp-N').addEventListener('input', () => {
  const N = parseInt(document.getElementById('inp-N').value, 10)
  if (N >= 1 && N <= 10 && N !== _lastTopoN) {
    setTopologyFromN(N)
    _lastTopoN = N
  }
})

document.getElementById('btn-calc').addEventListener('click', runCalculation)

document.querySelectorAll('.input-panel input').forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') runCalculation() })
})
