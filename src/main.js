import './style.css'

import { runAG00 } from './agents/ag00-validate.js'
import { runAG01 } from './agents/ag01-topology.js'
import { runAG11 } from './agents/ag11-pool-depth.js'
import { runAG12 } from './agents/ag12-maintenance-room.js'
import { runAG21 } from './agents/ag21-pump-spec.js'
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

async function runCalculation() {
  // ── AG0-0: 暴雨分析与径流估算 ────────────────────────────────────
  const ag00Params = {
    zone:     document.getElementById('inp-zone').value,
    T:        parseInt(document.getElementById('inp-T').value, 10),
    t_d:      parseFloat(document.getElementById('inp-td').value),
    A:        parseFloat(document.getElementById('inp-A').value),
    C:        parseFloat(document.getElementById('inp-C').value),
    N:        parseInt(document.getElementById('inp-N').value, 10),
    S:        parseFloat(document.getElementById('inp-S').value),
    Z_bottom: parseFloat(document.getElementById('inp-z-bottom').value),
    Z_top:    parseFloat(document.getElementById('inp-z-top').value),
  }

  const ag00 = runAG00(ag00Params)
  document.getElementById('card-ag00').innerHTML = renderAG00(ag00)

  const panel = document.getElementById('results-panel')
  panel.hidden = false

  // AG0-1: 若 N 或 N_spare 变化则重置默认拓扑
  const N_spare = parseInt(document.getElementById('inp-N-spare').value, 10) || 0
  if (ag00Params.N !== _lastTopoN || N_spare !== _lastTopoSpare) {
    setTopologyFromN(ag00Params.N, N_spare)
    _lastTopoN     = ag00Params.N
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

  // ── AG1-1: 调蓄池计算 ─────────────────────────────────────────────
  const ag1Params = {
    Q:        ag00.Q,
    Q_single: ag00.Q_single,
    Q_p:      ag00.Q_p,
    N:        ag00Params.N,
    S:        ag00Params.S,
    Z_bottom: ag00Params.Z_bottom,
    Z_top:    ag00Params.Z_top,
  }
  const ag1Result = runAG11(ag1Params)  // ag11-pool-depth.js = AG1-1 调蓄池计算
  document.getElementById('card-ag11').innerHTML = renderAG21(ag1Result)

  // ── AG2-1: 水泵选型计算 ───────────────────────────────────────────
  const ag2Params = {
    Q_single:    ag00.Q_single,
    Z_stop:      ag1Result.Z_stop,
    Z_discharge: parseFloat(document.getElementById('inp-z-discharge').value) || 5.0,
    L:           parseFloat(document.getElementById('inp-pipe-len').value) || 50,
    n:           parseFloat(document.getElementById('inp-n').value) || 0.013,
    η_hyd:       parseFloat(document.getElementById('inp-eta-hyd').value) || 0.82,
    η_mot:       parseFloat(document.getElementById('inp-eta-mot').value) || 0.93,
    NPSH_r:      parseFloat(document.getElementById('inp-npsh-r').value) || 3.0,
  }
  const motorOverride = parseFloat(document.getElementById('inp-motor').value)
  const ag2Result = runAG21(ag2Params, isNaN(motorOverride) ? null : motorOverride)  // ag21-pump-spec.js = AG2-1 水泵选型
  document.getElementById('card-ag21').innerHTML = renderAG11(ag2Result)

  // ── AG1-2: 维护间尺寸 ─────────────────────────────────────────────
  const effectiveMotor = isNaN(motorOverride) ? ag2Result.P_motor : motorOverride
  const ag12 = runAG12(ag00Params.N, effectiveMotor, N_spare)
  ag12.DN_label = ag2Result.DN_outlet
  document.getElementById('card-ag12').innerHTML = renderAG12(ag12)

  // ── AG3-1: SVG绘图 ───────────────────────────────────────────────
  runAG31(ag00Params.N, ag12, ag1Result, ag00Params.S, ag01.topology)

  // Update repair_zone hint from AG1-2 before reading AG4-1 params
  updateRepairZoneHint(ag12)

  // ── AG4-1/AG4-2: 布局生成与评分 ─────────────────────────────────
  const ag41Variants = await runAG41()
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
