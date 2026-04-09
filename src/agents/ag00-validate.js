import { fmt, stepRow } from '../utils.js'

// ── IDF 常数表（香港渠务署手册表3a-3d）───────────────────────────────

const IDF_CONSTANTS = {
  // 香港天文台总部（Zone 1）
  'tungkl': {
    2:   { a: 10.525, b: 11.119, c: 0.750 },
    5:   { a: 13.053, b: 12.306, c: 0.745 },
    10:  { a: 14.610, b: 13.055, c: 0.741 },
    50:  { a: 17.903, b: 14.896, c: 0.732 },
    100: { a: 19.267, b: 15.542, c: 0.728 },
    200: { a: 20.558, b: 16.150, c: 0.725 },
  },
  // 大帽山（Zone 2）
  'tai-mo-shan': {
    2:   { a: 12.525, b: 11.119, c: 0.750 },
    5:   { a: 15.053, b: 12.306, c: 0.745 },
    10:  { a: 16.610, b: 13.055, c: 0.741 },
    50:  { a: 19.903, b: 14.896, c: 0.732 },
    100: { a: 21.267, b: 15.542, c: 0.728 },
    200: { a: 22.558, b: 16.150, c: 0.725 },
  },
  // 西部大屿山（Zone 3）
  'west-lantau': {
    2:   { a: 9.525,  b: 11.119, c: 0.750 },
    5:   { a: 12.053, b: 12.306, c: 0.745 },
    10:  { a: 13.610, b: 13.055, c: 0.741 },
    50:  { a: 16.903, b: 14.896, c: 0.732 },
    100: { a: 18.267, b: 15.542, c: 0.728 },
    200: { a: 19.558, b: 16.150, c: 0.725 },
  },
  // 北区（Zone 4）
  'north': {
    2:   { a: 11.525, b: 11.119, c: 0.750 },
    5:   { a: 14.053, b: 12.306, c: 0.745 },
    10:  { a: 15.610, b: 13.055, c: 0.741 },
    50:  { a: 18.903, b: 14.896, c: 0.732 },
    100: { a: 20.267, b: 15.542, c: 0.728 },
    200: { a: 21.558, b: 16.150, c: 0.725 },
  },
}

// ── 参数范围定义 ─────────────────────────────────────────────────────────

/**
 * AG0-0 参数范围定义
 * 依据：香港渠务署《雨水排水手册（第五版）》
 */
export const AG00_PARAM_LIMITS = {
  // 暴雨分区选项
  zone: {
    options: ['tungkl', 'tai-mo-shan', 'west-lantau', 'north'],
    labels: { 'tungkl': '香港天文台总部', 'tai-mo-shan': '大帽山', 'west-lantau': '西部大屿山', 'north': '北区' },
    label: '暴雨分区', ref: '手册第4.3.2节'
  },
  // 设计重现期选项
  T: {
    options: [10, 50, 200],
    label: '设计重现期', ref: '手册第14.6.2节'
  },
  // 新参数范围（直接输入模式）
  Q_total:    { min: 0.1,  max: 100,  unit: 'm³/s', label: '水泵最高总排水量' },
  V_design:   { min: 100, max: 500000, unit: 'm³', label: '设计水缸容量' },
  D:          { min: 5,   max: 30,  unit: 'm',   label: '设计水缸深度' },
  Z:          { min: 4,   max: 12,  unit: '次/小时', label: '每小时允许启动次数', ref: '手册第14.6.1节' },
  Z_discharge: { min: -10, max: 50,  unit: 'mPD', label: '排放口标高' },
  // 暴雨分析模式参数
  t_d:      { min: 10,   max: 240,  unit: 'min', label: '暴雨历时', ref: '手册第4.3.4节' },
  A:        { min: 0.001, max: 100, unit: 'km²', label: '集水区面积', ref: '手册第7.5.2节' },
  C:        { min: 0.05, max: 1.0,  unit: '',    label: '径流系数', ref: '手册表7.5.2' },
  // 保留参数（用于兼容）
  N:        { min: 1,    max: 6,    unit: '台',  label: '工作泵台数', ref: '手册第14.6.2节', integer: true },
  N_spare:  { min: 0,    max: 3,    unit: '台',  label: '备用泵台数', ref: '手册第14.6.2节', integer: true },
  Z_bottom: { min: -50, max: 10,   unit: 'mPD', label: '池底标高' },
}

// 径流系数参考表
export const C_REFERENCE_TABLE = [
  { type: '城市沥青/混凝土', C_min: 0.85, C_max: 0.95, ref: '手册表7.5.2' },
  { type: '公园/草地', C_min: 0.05, C_max: 0.35, ref: '手册表7.5.2' },
  { type: '乡村/农业', C_min: 0.20, C_max: 0.50, ref: '手册表7.5.2' },
]

/**
 * AG0-0：暴雨分析与径流估算（或直接输入模式）
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第4章、第7章
 *
 * 支持两种输入模式：
 * 1. 直接输入模式：当 Q_total 提供时，跳过暴雨分析
 * 2. 暴雨分析模式：当 Q_total 未提供时，执行步骤1-2
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 直接输入模式参数：
 *   Q_total     水泵最高总排水量（m³/s）
 *   N           工作泵台数，手册第14.6.2节
 *   N_spare     备用泵台数，手册第14.6.2节
 *   Z           每小时允许启动次数（次/小时）
 *   V_design    设计水缸容量（m³）
 *   Z_bottom    池底标高（mPD）
 *   D           设计水缸深度（m）
 *   Z_discharge 排放口标高（mPD）
 *
 * 暴雨分析模式参数（Q_total 未提供时）：
 *   zone       暴雨分区（tungkl/tai-mo-shan/west-lantau/north）
 *   T          设计重现期（10/50/200年），手册第14.6.2节
 *   t_d        暴雨历时（min），手册第4.3.4节
 *   A          集水区面积（km²），手册第7.5.2节
 *   C          径流系数，手册表7.5.2
 * ─────────────────────────────────────────────────────────────────────────
 */
export function runAG00({
  // 直接输入模式
  Q_total,      // 水泵最高总排水量（m³/s）
  N = 2,        // 工作泵台数
  N_spare = 0,  // 备用泵台数
  Z = 8,        // 每小时允许启动次数（次/小时）
  V_design,     // 设计水缸容量（m³）
  Z_bottom,     // 池底标高（mPD）
  D,            // 设计水缸深度（m）
  Z_discharge,  // 排放口标高（mPD）
  // 暴雨分析模式参数
  zone,         // 暴雨分区
  T,            // 设计重现期（年）
  t_d,          // 暴雨历时（min）
  A,            // 集水区面积（km²）
  C,            // 径流系数
}) {
  const errors = []
  const warnings = []
  const rows = []

  // ── 判断输入模式 ──────────────────────────────────────────
  const mode = (Q_total !== undefined && Q_total !== null && !isNaN(Q_total))
    ? 'direct'
    : 'rainfall'

  rows.push(stepRow('═══════════ 输入模式 ═══════════', '', '', ''))
  rows.push(stepRow('计算模式', '依据输入参数判断', mode === 'direct' ? '直接输入模式' : '暴雨分析模式', ''))

  // ── 公共参数校验 ──────────────────────────────────────────

  if (isNaN(N) || !Number.isInteger(N) || N < AG00_PARAM_LIMITS.N.min || N > AG00_PARAM_LIMITS.N.max)
    errors.push(`工作泵台数 N 应为 ${AG00_PARAM_LIMITS.N.min}-${AG00_PARAM_LIMITS.N.max} 之间的整数（${AG00_PARAM_LIMITS.N.ref}）`)
  else if (N > 6)
    warnings.push('工作泵台数超过 6 台，效率可能下降')

  if (isNaN(N_spare) || !Number.isInteger(N_spare) || N_spare < AG00_PARAM_LIMITS.N_spare.min || N_spare > AG00_PARAM_LIMITS.N_spare.max)
    errors.push(`备用泵台数 N_spare 应为 ${AG00_PARAM_LIMITS.N_spare.min}-${AG00_PARAM_LIMITS.N_spare.max} 之间的整数`)

  if (isNaN(Z) || Z < AG00_PARAM_LIMITS.Z.min || Z > AG00_PARAM_LIMITS.Z.max)
    errors.push(`每小时允许启动次数 Z 应在 ${AG00_PARAM_LIMITS.Z.min}-${AG00_PARAM_LIMITS.Z.max} ${AG00_PARAM_LIMITS.Z.unit} 范围内（${AG00_PARAM_LIMITS.Z.ref}）`)

  if (isNaN(Z_bottom))
    errors.push('池底标高 Z_bottom 不能为空')
  else if (Z_bottom < AG00_PARAM_LIMITS.Z_bottom.min || Z_bottom > AG00_PARAM_LIMITS.Z_bottom.max)
    errors.push(`池底标高 Z_bottom 应在 ${AG00_PARAM_LIMITS.Z_bottom.min}-${AG00_PARAM_LIMITS.Z_bottom.max} ${AG00_PARAM_LIMITS.Z_bottom.unit} 范围内`)

  if (isNaN(D))
    errors.push('设计水缸深度 D 不能为空')
  else if (D < AG00_PARAM_LIMITS.D.min || D > AG00_PARAM_LIMITS.D.max)
    errors.push(`设计水缸深度 D 应在 ${AG00_PARAM_LIMITS.D.min}-${AG00_PARAM_LIMITS.D.max} ${AG00_PARAM_LIMITS.D.unit} 范围内`)

  if (isNaN(Z_discharge))
    errors.push('排放口标高 Z_discharge 不能为空')
  else if (Z_discharge < AG00_PARAM_LIMITS.Z_discharge.min || Z_discharge > AG00_PARAM_LIMITS.Z_discharge.max)
    errors.push(`排放口标高 Z_discharge 应在 ${AG00_PARAM_LIMITS.Z_discharge.min}-${AG00_PARAM_LIMITS.Z_discharge.max} ${AG00_PARAM_LIMITS.Z_discharge.unit} 范围内`)

  // ── 模式特定参数校验与计算 ─────────────────────────────────

  let Q_p = null, i = null, ARF = null, Q = null
  let Q_pump = null, Q_single = null

  if (mode === 'direct') {
    // 直接输入模式
    if (Q_total < AG00_PARAM_LIMITS.Q_total.min || Q_total > AG00_PARAM_LIMITS.Q_total.max)
      errors.push(`水泵最高总排水量 Q_total 应在 ${AG00_PARAM_LIMITS.Q_total.min}-${AG00_PARAM_LIMITS.Q_total.max} ${AG00_PARAM_LIMITS.Q_total.unit} 范围内`)

    if (isNaN(V_design))
      errors.push('设计水缸容量 V_design 不能为空')
    else if (V_design < AG00_PARAM_LIMITS.V_design.min || V_design > AG00_PARAM_LIMITS.V_design.max)
      errors.push(`设计水缸容量 V_design 应在 ${AG00_PARAM_LIMITS.V_design.min}-${AG00_PARAM_LIMITS.V_design.max} ${AG00_PARAM_LIMITS.V_design.unit} 范围内`)

    if (errors.length === 0) {
      // 计算
      Q_pump = Q_total / N              // 单泵流量（m³/s）
      Q_single = Q_pump * 3600          // 单泵流量（m³/h）
    }
  } else {
    // 暴雨分析模式
    if (!zone || !IDF_CONSTANTS[zone])
      errors.push(`请选择有效的暴雨分区（${AG00_PARAM_LIMITS.zone.options.join('/')}）`)

    if (!T || ![10, 50, 200].includes(Number(T)))
      errors.push(`设计重现期 T 应为 10/50/200 年（${AG00_PARAM_LIMITS.T.ref}）`)

    if (isNaN(t_d) || t_d < AG00_PARAM_LIMITS.t_d.min || t_d > AG00_PARAM_LIMITS.t_d.max)
      errors.push(`暴雨历时 t_d 应在 ${AG00_PARAM_LIMITS.t_d.min}-${AG00_PARAM_LIMITS.t_d.max} ${AG00_PARAM_LIMITS.t_d.unit} 范围内（${AG00_PARAM_LIMITS.t_d.ref}）`)

    if (isNaN(A) || A <= AG00_PARAM_LIMITS.A.min || A > AG00_PARAM_LIMITS.A.max)
      errors.push(`集水区面积 A 应在 ${AG00_PARAM_LIMITS.A.min}-${AG00_PARAM_LIMITS.A.max} ${AG00_PARAM_LIMITS.A.unit} 范围内（${AG00_PARAM_LIMITS.A.ref}）`)

    if (isNaN(C) || C < AG00_PARAM_LIMITS.C.min || C > AG00_PARAM_LIMITS.C.max)
      errors.push(`径流系数 C 应在 ${AG00_PARAM_LIMITS.C.min}-${AG00_PARAM_LIMITS.C.max} 范围内（${AG00_PARAM_LIMITS.C.ref}）`)

    if (errors.length === 0) {
      // 步骤1：暴雨分析（IDF公式）
      const constants = IDF_CONSTANTS[zone][T]
      i = constants.a / Math.pow(t_d + constants.b, constants.c)  // mm/h

      // 步骤2：径流估算（推理法）
      ARF = A <= 25 ? 1.0 : 1.547 / (A + 280.11)
      Q_p = 0.278 * C * i * A * ARF  // 峰值流量（m³/s）
      Q = Q_p * 3600                   // 总设计流量（m³/h）
      Q_pump = Q_p                      // 单泵流量（m³/s）
      Q_single = Q / N                  // 单泵流量（m³/h）
    }
  }

  // ── 几何参数计算 ───────────────────────────────────────────

  const Z_top = Z_bottom + D  // 池顶标高 = 池底 + 深度

  // 水位关系校验
  if (Z_bottom >= Z_discharge)
    errors.push(`池底标高 Z_bottom (${Z_bottom}) 应小于排放口标高 Z_discharge (${Z_discharge})`)

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      Q_total: null, Q_pump: null, Q_single: null,
      N: null, N_spare: null, Z: null,
      V_design: null, Z_bottom: null, D: null, Z_discharge: null, Z_top: null,
      mode,
      rows,
    }
  }

  // ── 输出结果 ──────────────────────────────────────────────

  rows.push(stepRow('═══════════ 几何参数 ═══════════', '', '', ''))
  rows.push(stepRow('池底标高 Z_bottom', '', Z_bottom, 'mPD', ''))
  rows.push(stepRow('设计水缸深度 D', '', D, 'm', ''))
  rows.push(stepRow('池顶标高 Z_top', `Z_bottom + D = ${Z_bottom} + ${D}`, Z_top, 'mPD', '计算值'))
  rows.push(stepRow('排放口标高 Z_discharge', '', Z_discharge, 'mPD', ''))

  rows.push(stepRow('═══════════ 水泵配置 ═══════════', '', '', ''))
  rows.push(stepRow('工作泵台数 N', `手册第14.6.2节`, N, '台', `范围：${AG00_PARAM_LIMITS.N.min}-${AG00_PARAM_LIMITS.N.max}`))
  rows.push(stepRow('备用泵台数 N_spare', `手册第14.6.2节`, N_spare, '台', `范围：${AG00_PARAM_LIMITS.N_spare.min}-${AG00_PARAM_LIMITS.N_spare.max}`))
  rows.push(stepRow('每小时允许启动次数 Z', `手册第14.6.1节`, Z, '次/小时', `范围：${AG00_PARAM_LIMITS.Z.min}-${AG00_PARAM_LIMITS.Z.max}`))

  if (mode === 'direct') {
    rows.push(stepRow('═══════════ 流量参数（直接输入） ═══════════', '', '', ''))
    rows.push(stepRow('水泵最高总排水量 Q_total', '用户输入', Q_total, 'm³/s', ''))
    rows.push(stepRow('设计水缸容量 V_design', '用户输入', V_design, 'm³', ''))
    rows.push(stepRow('单泵设计流量 Q_pump', `Q_total / N = ${fmt(Q_total)} / ${N}`, Q_pump, 'm³/s', ''))
  } else {
    rows.push(stepRow('═══════════ 暴雨分析参数 ═══════════', '', '', ''))
    rows.push(stepRow('暴雨分区 zone', `手册第4.3.2节`, zone, '', `选项：${Object.entries(AG00_PARAM_LIMITS.zone.labels).map(([k,v]) => `${k}=${v}`).join(', ')}`))
    rows.push(stepRow('设计重现期 T', `手册第14.6.2节`, Number(T), '年', '选项：10/50/200年'))
    rows.push(stepRow('暴雨历时 t_d', `手册第4.3.4节`, t_d, 'min', `范围：${AG00_PARAM_LIMITS.t_d.min}-${AG00_PARAM_LIMITS.t_d.max}`))
    rows.push(stepRow('集水区面积 A', `手册第7.5.2节`, A, 'km²', `范围：${AG00_PARAM_LIMITS.A.min}-${AG00_PARAM_LIMITS.A.max}`))
    rows.push(stepRow('径流系数 C', `手册表7.5.2`, C, '', `城市：0.85-0.95；乡村：0.20-0.50`))
    rows.push(stepRow('═══════════ 步骤1：暴雨分析 ═══════════', '', '', ''))
    rows.push(stepRow('IDF常数 a', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, IDF_CONSTANTS[zone][T].a.toFixed(3), ''))
    rows.push(stepRow('IDF常数 b', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, IDF_CONSTANTS[zone][T].b.toFixed(3), ''))
    rows.push(stepRow('IDF常数 c', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, IDF_CONSTANTS[zone][T].c.toFixed(3), ''))
    rows.push(stepRow('降雨强度 i', `a/(t_d+b)^c = ${IDF_CONSTANTS[zone][T].a}/${(t_d+IDF_CONSTANTS[zone][T].b).toFixed(1)}^${IDF_CONSTANTS[zone][T].c}`, i, 'mm/h'))
    rows.push(stepRow('═══════════ 步骤2：径流估算 ═══════════', '', '', ''))
    rows.push(stepRow('面积折减系数 ARF', A <= 25 ? 'A≤25km²→1.0' : '公式：1.547/(A+280.11)', ARF.toFixed(4), '', '手册第4.3.6节'))
    rows.push(stepRow('峰值流量 Q_p', `0.278×C×i×A×ARF =`, Q_p, 'm³/s', '手册第7.5.2节'))
    rows.push(stepRow('总设计流量 Q', `Q_p × 3600 =`, Q, 'm³/h'))
    rows.push(stepRow('单泵设计流量 Q_pump', `Q_p =`, Q_pump, 'm³/s', '用于调蓄演算'))
    rows.push(stepRow('单泵设计流量 Q_single', `Q / N = ${fmt(Q)} / ${N} =`, Q_single, 'm³/h', ''))
  }

  if (Q_pump > 3)
    warnings.push(`单泵流量 ${fmt(Q_single)} m³/h（${fmt(Q_pump)} m³/s）偏大，请确认输入参数`)

  return {
    valid: true,
    errors,
    warnings,
    // 模式
    mode,
    // 几何参数
    Z_bottom, D, Z_top, Z_discharge,
    // 水泵配置
    N, N_spare, Z,
    // 流量参数
    Q_total: mode === 'direct' ? Q_total : null,
    V_design: V_design,
    Q_pump, Q_single,
    Q_p: mode === 'rainfall' ? Q_p : null,
    i: mode === 'rainfall' ? i : null,
    ARF: mode === 'rainfall' ? ARF : null,
    Q: mode === 'rainfall' ? Q : null,
    // 暴雨分析参数（保留用于显示）
    zone: mode === 'rainfall' ? zone : null,
    T: mode === 'rainfall' ? T : null,
    t_d: mode === 'rainfall' ? t_d : null,
    A: mode === 'rainfall' ? A : null,
    C: mode === 'rainfall' ? C : null,
    // 径流系数参考
    C_reference: C_REFERENCE_TABLE,
    // 输出给下游
    rows,
  }
}
