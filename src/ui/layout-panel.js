import { renderLayoutSVG, renderLayoutSVGDual } from '../render/layout-svg.js'
import { initSvgZoomPan } from '../render/zoom-pan.js'

// Module-level state
let _variants = []
let _selectedIdx = 0
const VW = 1080, VH = 560

/**
 * Render the AG4-1 panel: thumbnail cards + detail view.
 * @param {Array} variants  Sorted result from runAG41()
 */
export function renderLayoutPanel(variants) {
  _variants = variants
  _selectedIdx = 0

  const container = document.getElementById('layout-variants')
  if (!container) return

  container.innerHTML = variants.map((v, i) => {
    const t = v.template
    const thumbSvg = renderLayoutSVG(v, 360, 200, { showDims: false, showCrane: true })
    return `
      <div class="variant-card ${i === 0 ? 'selected' : ''}" data-idx="${i}"
           onclick="window._ag41SelectVariant(${i})">
        <div class="vc-header">
          <span>方案 ${t.id}：${t.label}</span>
          <span class="vc-score">得分 ${v.score}</span>
        </div>
        <svg class="vc-thumb" viewBox="0 0 360 200">${thumbSvg}</svg>
        <div class="vc-desc">${t.desc}</div>
        <div class="vc-metrics">
          占地：${(t.buildingW / 1000).toFixed(1)} m × ${(t.buildingD / 1000).toFixed(1)} m
          &nbsp;|&nbsp; 面积：${Math.round(t.buildingW * t.buildingD / 1e6)} m²
          ${v.violations.length > 0 ? `&nbsp;|&nbsp; <span style="color:#c0392b">⚠ ${v.violations.length} 项约束未满足</span>` : ''}
        </div>
        <button class="vc-select-btn" onclick="event.stopPropagation();window._ag41ConfirmVariant(${i})">
          选用此方案 →
        </button>
      </div>
    `
  }).join('')

  // Show and render the first variant in detail
  selectVariant(0)
  document.getElementById('card-ag41-wrap').hidden = false
}

/**
 * Select a variant: highlight card + refresh detail SVG.
 */
function selectVariant(idx) {
  _selectedIdx = idx
  document.querySelectorAll('.variant-card').forEach((el, i) =>
    el.classList.toggle('selected', i === idx)
  )

  const v = _variants[idx]
  const svg = document.getElementById('svg-ag41')
  if (!svg) return

  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`)
  svg.innerHTML = renderLayoutSVGDual(v, VW, VH)
  initSvgZoomPan(svg, VW, VH, { zIn: 'btn-ag41-zin', zOut: 'btn-ag41-zout', zRst: 'btn-ag41-rst' })

  document.getElementById('layout-detail-wrap').hidden = false
}

// Expose to global scope for inline onclick handlers
window._ag41SelectVariant  = selectVariant

window._ag41ConfirmVariant = function(idx) {
  _selectedIdx = idx
  selectVariant(idx)
  // Notify main flow that a layout was confirmed
  window.dispatchEvent(new CustomEvent('ag41-layout-confirmed', {
    detail: { variant: _variants[idx] }
  }))
}

export function getSelectedVariant() {
  return _variants[_selectedIdx] || null
}
