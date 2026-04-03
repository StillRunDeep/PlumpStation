import { renderLayoutSVG, renderLayoutSVGDual } from '../render/layout-svg.js'
import { initSvgZoomPan } from '../render/zoom-pan.js'

// Module-level state
let _variants = []
let _selectedIdx = 0
const VW = 1080, VH = 560

/**
 * Build the score comparison table shown above the variant cards.
 */
function renderComparisonTable(variants) {
  const bdSign = v => v >= 0 ? `+${v}` : `${v}`

  const rows = variants.map((v, i) => {
    const t   = v.template
    const bd  = v.breakdown || {}
    const mustSat = (v.adjacency?.satisfied  || []).filter(a => a.type === 'must').length
    const mustTot = mustSat + (v.adjacency?.violated || []).filter(a => a.type === 'must').length
    const violCell = v.violations.length === 0
      ? `<span style="color:#27ae60">✓</span>`
      : `<span style="color:#c0392b">⚠ ${v.violations.length}</span>`
    const area = Math.round(t.buildingW * t.buildingD / 1e6)
    const eff  = v.spaceEfficiency != null ? (v.spaceEfficiency * 100).toFixed(1) + '%' : '—'

    const bdDetail = `
      <details><summary style="cursor:pointer;font-size:11px;color:#666">明细</summary>
      <table style="font-size:11px;margin-top:4px;border-collapse:collapse">
        <tr><td style="padding:1px 6px">基础分</td><td style="text-align:right">${bdSign(bd.base ?? 10000)}</td></tr>
        <tr><td style="padding:1px 6px">占地面积</td><td style="text-align:right;color:#c0392b">${bdSign(bd.footprint ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">临近关系</td><td style="text-align:right;color:#27ae60">${bdSign(bd.adjacency ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">走廊完整</td><td style="text-align:right;color:#27ae60">${bdSign(bd.corridor ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">变压器布置</td><td style="text-align:right;color:#27ae60">${bdSign(bd.trafo ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">风机房距离</td><td style="text-align:right;color:#27ae60">${bdSign(bd.fanRoom ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">空间有效率</td><td style="text-align:right;color:#27ae60">${bdSign(bd.efficiency ?? 0)}</td></tr>
        <tr><td style="padding:1px 6px">约束违反</td><td style="text-align:right;color:#c0392b">${bdSign(bd.violations ?? 0)}</td></tr>
      </table></details>`

    return `
      <tr style="cursor:pointer;background:${i % 2 === 0 ? '#f8fafc' : '#fff'}" onclick="window._ag41SelectVariant(${i})">
        <td style="text-align:center;font-weight:600">${i + 1}</td>
        <td><strong>${t.id}</strong><br><span style="font-size:11px;color:#555">${t.label}</span></td>
        <td style="text-align:right;font-weight:700;color:#1a5276">${v.score}</td>
        <td style="text-align:right">${area}</td>
        <td style="text-align:right">${eff}</td>
        <td style="text-align:center">${mustSat} / ${mustTot}</td>
        <td style="text-align:center">${violCell}</td>
        <td>${bdDetail}</td>
      </tr>`
  }).join('')

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead>
        <tr style="background:#1a3a5c;color:#fff;font-size:12px">
          <th style="padding:7px 8px">排名</th>
          <th style="padding:7px 8px;text-align:left">方案</th>
          <th style="padding:7px 8px;text-align:right">综合得分</th>
          <th style="padding:7px 8px;text-align:right">占地 m²</th>
          <th style="padding:7px 8px;text-align:right">空间有效率</th>
          <th style="padding:7px 8px">必须临近</th>
          <th style="padding:7px 8px">约束违反</th>
          <th style="padding:7px 8px">得分明细</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`
}

/**
 * Render the AG4-1 panel: comparison table + thumbnail cards + detail view.
 * @param {Array} variants  Sorted result from runAG42()
 */
export function renderLayoutPanel(variants) {
  _variants = variants
  _selectedIdx = 0

  const container = document.getElementById('layout-variants')
  if (!container) return

  const cmp = document.getElementById('layout-comparison')
  if (cmp) cmp.innerHTML = renderComparisonTable(variants)

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
          &nbsp;|&nbsp; 空间有效率：${v.spaceEfficiency != null ? Math.round(v.spaceEfficiency * 100) + '%' : '—'}
          ${v.violations.length > 0 ? `&nbsp;|&nbsp; <span style="color:#c0392b">⚠ ${v.violations.length} 项约束未满足</span>` : ''}
        </div>
        <button class="vc-select-btn" onclick="event.stopPropagation();window._ag41ConfirmVariant(${i})">
          选用此方案 →
        </button>
      </div>
    `
  }).join('')

  // Update badge to reflect actual variant count
  const badge = document.getElementById('ag41-badge')
  if (badge) badge.textContent = `${variants.length} 种方案`

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
