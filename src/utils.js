export const DN_SERIES = [100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1250, 1500]

export function selectDN(d_mm) {
  for (const dn of DN_SERIES) {
    if (dn >= d_mm) return dn
  }
  return DN_SERIES[DN_SERIES.length - 1]
}

export function ceilTo01(v) {
  return Math.ceil(v * 10) / 10
}

export function fmt(v, decimals = 2) {
  return v.toFixed(decimals)
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
