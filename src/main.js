import './style.css'

import { runAG00 } from './agents/ag00-validate.js'
import { runAG11 } from './agents/ag11-pump-spec.js'
import { runAG12 } from './agents/ag12-maintenance-room.js'
import { runAG21 } from './agents/ag21-pool-depth.js'
import { runAG31 } from './agents/ag31-drawing.js'
import { runAG41 } from './agents/ag41-building-layout.js'
import { runAG42 } from './agents/ag42-layout-eval.js'

import { renderAG00, renderAG11, renderAG12, renderAG21 } from './ui/results-panel.js'
import { renderLayoutPanel } from './ui/layout-panel.js'

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

  // AG3-1: pump-room SVG (plan + section)
  runAG31(N, ag12, ag21, S)

  // Update repair_zone hint from AG1-2 before reading AG4-1 params
  updateRepairZoneHint(ag12)

  // AG4-1: building layout generation with user parameters
  const ag41Variants = await runAG41()

  // AG4-2: evaluation & scoring
  const ag42Variants = runAG42(ag41Variants)
  renderLayoutPanel(ag42Variants)

  panel.scrollIntoView({ behavior: 'smooth' })
}

// ── Event wiring ──────────────────────────────────────────────────────

document.getElementById('btn-calc').addEventListener('click', runCalculation)

document.querySelectorAll('.input-panel input').forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') runCalculation() })
})
