export const DN_SERIES = [100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1250, 1500]

export function selectDN(d_mm) {
  if (!Number.isFinite(d_mm) || d_mm <= 0) return DN_SERIES[0]
  for (const dn of DN_SERIES) {
    if (dn >= d_mm) return dn
  }
  return DN_SERIES[DN_SERIES.length - 1]
}

/**
 * 通用参数校验函数
 * @param {Object} params - 待校验参数对象
 * @param {Object} limits - 参数范围定义，格式为 { paramName: { min, max, unit, label, ref } }
 * @returns {Array} 错误信息数组
 */
export function validateParams(params, limits) {
  const errors = []
  for (const [key, limit] of Object.entries(limits)) {
    const value = params[key]
    if (value === undefined) continue
    // 整数参数校验
    if (limit.integer && (!Number.isInteger(value) || value < limit.min || value > limit.max)) {
      const rangeStr = limit.unit ? `${limit.min}-${limit.max} ${limit.unit}` : `${limit.min}-${limit.max}`
      errors.push(`${limit.label} ${key} 应为 ${rangeStr} 之间的整数`)
      continue
    }
    // 浮点数参数校验
    if (Number.isFinite(value) && (value < limit.min || value > limit.max)) {
      let msg = `${limit.label} 应在 ${limit.min}-${limit.max}`
      if (limit.unit) msg += ` ${limit.unit}`
      if (limit.ref) msg += `（${limit.ref}）`
      errors.push(msg)
    }
  }
  return errors
}

export function ceilTo01(v) {
  return Math.ceil(v * 10) / 10
}

export function fmt(v, decimals = 2) {
  if (v === null || v === undefined || isNaN(v) || !Number.isFinite(v)) return '—'
  return Number(v).toFixed(decimals)
}

export function stepRow(label, formula, value, unit) {
  return `<tr>
    <td>${label}</td>
    <td class="formula">${formula}</td>
    <td class="value">${value}&nbsp;<small>${unit}</small></td>
  </tr>`
}

export function stepsTable(rows) {
  const dataRows = rows.filter(row => !row.includes('═'))
  if (dataRows.length === 0) return ''
  return `<table class="steps-table">
    <thead><tr><th>参数</th><th>计算式</th><th style="text-align:right">结果</th></tr></thead>
    <tbody>${dataRows.join('')}</tbody>
  </table>`
}

export function kvRow(label, val) {
  return `<div class="key-value"><span class="kv-label">${label}</span><span class="kv-val">${val}</span></div>`
}
