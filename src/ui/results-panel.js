import { fmt, stepsTable, kvRow } from '../utils.js'

export function renderAG00(r) {
  const status = r.valid ? (r.warnings.length > 0 ? 'warn' : 'pass') : 'error'
  const icon   = status === 'pass' ? '✔' : status === 'warn' ? '⚠' : '✘'
  const label  = status === 'pass' ? '验证通过' : status === 'warn' ? '通过（有警告）' : '验证失败'

  let msgs = ''
  r.errors.forEach(e   => { msgs += `<li><span class="icon err">✘</span> <span class="err">${e}</span></li>` })
  r.warnings.forEach(w => { msgs += `<li><span class="icon wrn">⚠</span> <span class="wrn">${w}</span></li>` })
  if (r.errors.length === 0 && r.warnings.length === 0)
    msgs = '<li><span class="icon ok">✔</span> <span class="ok">所有参数合法，可继续计算</span></li>'

  let summary = ''
  if (r.valid) {
    summary = `
      ${kvRow('总设计流量 Q', fmt(r.Q, 2) + ' m³/h')}
      ${kvRow('工作水泵台数 N', r.N + ' 台')}
      ${kvRow('集水池面积 S', fmt(r.S, 2) + ' m²')}
    `
  }

  return `
    <div style="margin-bottom:12px">
      <span style="font-weight:700;color:var(--color-${status})">${icon} ${label}</span>
    </div>
    <ul class="msg-list">${msgs}</ul>
    ${r.valid ? `<div class="result-summary ${status}" style="margin-top:12px">${summary}</div>` : ''}
  `
}

export function renderAG11(r) {
  const dnWarn = r.dnOverflow
    ? `<p style="color:var(--color-warn);font-size:12px;margin-top:8px">⚠ 计算管径超出标准系列上限 DN1500，建议与厂家确认定制管径。</p>`
    : ''
  const effClass = r.effPass ? 'pass' : 'fail'
  const effMsg   = r.effPass
    ? `工作点效率 η=${r.η} ≥ 0.85×η_BEP(${r.η_BEP}) = ${fmt(r.η_threshold, 2)}，满足 R-HY-03`
    : `工作点效率 η=${r.η} < 0.85×η_BEP(${r.η_BEP}) = ${fmt(r.η_threshold, 2)}，不满足 R-HY-03，建议调整台数或更换水泵型号`
  return `
    ${stepsTable(r.rows)}
    <div class="result-summary pass">
      ${kvRow('单泵设计流量', fmt(r.Q_single, 2) + ' m³/h')}
      ${kvRow('系统设计扬程 H', fmt(r.H, 2) + ' m')}
      ${kvRow('电机功率 P_motor', fmt(r.P_motor, 2) + ' kW')}
      ${kvRow('进水管公称内径 DN_inlet', 'DN ' + r.DN_inlet + ' mm')}
      ${kvRow('出水管公称内径 DN_outlet', 'DN ' + r.DN_outlet + ' mm')}
    </div>
    <div class="result-summary ${effClass}" style="margin-top:8px;font-size:12px">
      <strong>工作点效率验证（R-HY-03）：</strong>${effMsg}
    </div>
    ${dnWarn}
  `
}

export function renderAG12(r) {
  return `
    ${stepsTable(r.rows)}
    <div class="result-summary pass">
      ${kvRow('泵间净距', fmt(r.d_spacing, 1) + ' m')}
      ${kvRow('端部距墙净距', fmt(r.e_wall, 1) + ' m')}
      ${kvRow('维护间净长 L', fmt(r.L, 1) + ' m')}
      ${kvRow('维护间净宽 W', fmt(r.W, 1) + ' m')}
    </div>
  `
}

export function renderAG21(r) {
  const lvlRows = r.startLevels.map((lv, i) =>
    `<tr><td>水泵 ${i + 1}</td><td>${fmt(lv, 2)} m</td></tr>`
  ).join('')

  const staggerTable = `
    <p style="font-size:12px;font-weight:600;color:#555;margin:10px 0 4px">梯级启泵水位（R-CL-01）</p>
    <table class="steps-table">
      <thead><tr><th>水泵</th><th>启泵水位</th></tr></thead>
      <tbody>
        ${lvlRows}
        <tr><td>统一停泵水位</td><td>${fmt(r.stopLevel, 2)} m</td></tr>
        <tr><td>报警水位</td><td>${fmt(r.alarmLevel, 2)} m</td></tr>
      </tbody>
    </table>
  `

  const diagram = `
    <div class="wl-diagram">
      <div>
        <p style="font-size:11px;font-weight:600;color:#555;margin-bottom:6px">水位示意</p>
        <div class="wl-labels">
          <div class="wl-tick"><div class="dot dot-pool"></div><span>池顶 h_pool = ${fmt(r.h_pool, 1)} m</span></div>
          <div class="wl-tick"><div class="dot dot-alarm"></div><span>报警 alarmLevel = ${fmt(r.alarmLevel, 2)} m</span></div>
          <div class="wl-tick"><div class="dot dot-start"></div><span>启泵 startLevel = ${fmt(r.startLevel, 2)} m</span></div>
          <div class="wl-tick"><div class="dot dot-stop"></div><span>停泵 stopLevel = ${fmt(r.stopLevel, 2)} m</span></div>
        </div>
      </div>
    </div>
  `

  return `
    ${stepsTable(r.rows)}
    <div class="result-summary pass">
      ${kvRow('最小有效容积 V_min', fmt(r.V_min, 2) + ' m³')}
      ${kvRow('有效调节水深', fmt(r.h_active, 2) + ' m')}
      ${kvRow('集水池有效深度 h_pool', fmt(r.h_pool, 1) + ' m')}
    </div>
    ${staggerTable}
    ${diagram}
  `
}
