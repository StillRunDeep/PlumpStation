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

let _lastTopoN     = null
let _lastTopoSpare = 0

// ── AG4-1 parameter helpers ───────────────────────────────────────────

/**
 * Read optional numeric input. Returns null if empty or invalid.
 */
function readOptional(id) {
  const v = parseFloat(document.getElementById(id)?.value)
  return isNaN(v) || v <= 0 ? null : v
}

/**
 * Collect AG4-1 user parameters from the input panel.
 * All room areas are in m²; dimensions in mm.
 */
function readAG41Params(ag12) {
  const bW = parseFloat(document.getElementById('inp-bw')?.value) || 18600
  const bD = parseFloat(document.getElementById('inp-bd')?.value) || 24000

  const roomAreas = {}

  const raRepair  = readOptional('ra-repair')
  const raParking = readOptional('ra-parking')
  const raLv      = readOptional('ra-lv')
  const raCp      = readOptional('ra-cp')
  const raFan     = readOptional('ra-fan')
  const raRw      = readOptional('ra-rw')

  if (raRepair  !== null) roomAreas.repair_zone = raRepair
  if (raParking !== null) roomAreas.parking     = raParking
  if (raLv      !== null) roomAreas.lv_control  = raLv
  if (raCp      !== null) roomAreas.clean_pump  = raCp
  if (raFan     !== null) roomAreas.fan_room    = raFan
  if (raRw      !== null) roomAreas.rainwater   = raRw

  return { buildingW: Math.round(bW / 100) * 100, buildingD: Math.round(bD / 100) * 100, roomAreas }
}

/**
 * Auto-fill the repair_zone area hint from AG1-2 output.
 * The repair zone should be at least L × W from the maintenance-room calc.
 */
function updateRepairZoneHint(ag12) {
  const noteEl = document.getElementById('ra-repair-note')
  const inputEl = document.getElementById('ra-repair')
  if (!noteEl || !inputEl) return

  const area = Math.ceil(ag12.L * ag12.W)  // m²
  noteEl.innerHTML =
    `继承自 AG1-2：维护间净长 <strong>${ag12.L.toFixed(1)} m</strong> × ` +
    `净宽 <strong>${ag12.W.toFixed(1)} m</strong> ≈ <strong>${area} m²</strong>。` +
    `当前输入值为用户指定值；留空则使用比例算法默认值。`

  // Only auto-fill if the user hasn't entered a value
  if (!inputEl.value) {
    inputEl.placeholder = `≈ ${area}（AG1-2）`
  }
}

// ── Main calculation controller ───────────────────────────────────────

function runCalculation() {
  const Q        = parseFloat(document.getElementById('inp-Q').value)
  const N        = parseInt(document.getElementById('inp-N').value, 10)
  const N_spare  = parseInt(document.getElementById('inp-N-spare').value, 10) || 0
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

  // AG0-1: 若 N 或 N_spare 变化则重置默认拓扑
  if (N !== _lastTopoN || N_spare !== _lastTopoSpare) {
    setTopologyFromN(N, N_spare)
    _lastTopoN     = N
    _lastTopoSpare = N_spare
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
  const ag12 = runAG12(N, effectiveMotor, N_spare)
  ag12.DN_label = ag11.DN_outlet
  document.getElementById('card-ag12').innerHTML = renderAG12(ag12)

  // AG3-1: pump-room SVG (plan + section)，从 ag01 取拓扑（单向数据流）
  runAG31(N, ag12, ag21, S, ag01.topology)

  // Update repair_zone hint from AG1-2 before reading AG4-1 params
  updateRepairZoneHint(ag12)

  // AG4-1: building layout generation with user parameters
  const ag41Params   = readAG41Params(ag12)
  const ag41Variants = runAG41(ag41Params)

  // AG4-2: evaluation & scoring
  const ag42Variants = runAG42(ag41Variants)
  renderLayoutPanel(ag42Variants)

  panel.scrollIntoView({ behavior: 'smooth' })
}

// ── Event wiring ──────────────────────────────────────────────────────

// ── 初始化 AG0-1 拓扑编辑器 ──────────────────────────────────────────
const _initN = parseInt(document.getElementById('inp-N').value, 10) || 3
initTopologyEditor('topology-editor-wrap', () => {})
setTopologyFromN(_initN)
_lastTopoN = _initN

function _updateTopo() {
  const N       = parseInt(document.getElementById('inp-N').value, 10)
  const N_spare = parseInt(document.getElementById('inp-N-spare').value, 10) || 0
  if (N >= 1 && N <= 10 && (N !== _lastTopoN || N_spare !== _lastTopoSpare)) {
    setTopologyFromN(N, N_spare)
    _lastTopoN     = N
    _lastTopoSpare = N_spare
  }
}

document.getElementById('inp-N').addEventListener('input', _updateTopo)
document.getElementById('inp-N-spare').addEventListener('input', _updateTopo)

document.getElementById('btn-calc').addEventListener('click', runCalculation)

document.querySelectorAll('.input-panel input').forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') runCalculation() })
})
