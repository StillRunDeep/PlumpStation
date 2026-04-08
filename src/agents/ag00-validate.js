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
  // 输入参数范围
  t_d:      { min: 10,   max: 240,  unit: 'min', label: '暴雨历时', ref: '手册第4.3.4节' },
  A:        { min: 0.001, max: 100, unit: 'km²', label: '集水区面积', ref: '手册第7.5.2节' },
  C:        { min: 0.05, max: 1.0,  unit: '',    label: '径流系数', ref: '手册表7.5.2' },
  N:        { min: 1,    max: 6,    unit: '台',  label: '工作泵台数', ref: '手册第14.6.2节', integer: true },
  S:        { min: 10,   max: 100000, unit: 'm²', label: '集水池面积' },
  Z_bottom: { min: -30, max: 10,   unit: 'mPD', label: '池底标高' },
  Z_top:    { min: -10,  max: 50,   unit: 'mPD', label: '池顶标高' },
}

// 径流系数参考表
export const C_REFERENCE_TABLE = [
  { type: '城市沥青/混凝土', C_min: 0.85, C_max: 0.95, ref: '手册表7.5.2' },
  { type: '公园/草地', C_min: 0.05, C_max: 0.35, ref: '手册表7.5.2' },
  { type: '乡村/农业', C_min: 0.20, C_max: 0.50, ref: '手册表7.5.2' },
]

/**
 * AG0-0：暴雨分析与径流估算
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第4章、第7章
 *
 * 步骤1：暴雨分析（IDF公式）
 *   i = a / (t_d + b)^c  (mm/h)
 *
 * 步骤2：径流估算（推理法）
 *   Q_p = 0.278 × C × i × A × ARF  (m³/s)
 *   Q = Q_p × 3600  (m³/h)
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 输入参数：
 *   zone       暴雨分区（tungkl/tai-mo-shan/west-lantau/north）
 *   T          设计重现期（10/50/200年），手册第14.6.2节
 *   t_d        暴雨历时（min），手册第4.3.4节
 *   A          集水区面积（km²），手册第7.5.2节
 *   C          径流系数，手册表7.5.2
 *   N          工作泵台数，手册第14.6.2节
 *   S          集水池面积（m²）
 *   Z_bottom   池底标高（mPD）
 *   Z_top      池顶标高（mPD）
 * ─────────────────────────────────────────────────────────────────────────
 */
export function runAG00({
  zone,      // 暴雨分区
  T,         // 设计重现期（年）
  t_d,       // 暴雨历时（min）
  A,         // 集水区面积（km²）
  C,         // 径流系数
  N,         // 工作泵台数
  S,         // 集水池面积（m²）
  Z_bottom,  // 池底标高（mPD）
  Z_top,     // 池顶标高（mPD）
}) {
  const errors = []
  const warnings = []

  // ── 参数校验 ──────────────────────────────────────────────

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

  if (isNaN(N) || !Number.isInteger(N) || N < AG00_PARAM_LIMITS.N.min || N > AG00_PARAM_LIMITS.N.max)
    errors.push(`工作泵台数 N 应为 ${AG00_PARAM_LIMITS.N.min}-${AG00_PARAM_LIMITS.N.max} 之间的整数（${AG00_PARAM_LIMITS.N.ref}）`)
  else if (N > 6)
    warnings.push('工作泵台数超过 6 台，效率可能下降')

  if (isNaN(S) || S <= 0)
    errors.push(`集水池面积 S 必须大于 0 ${AG00_PARAM_LIMITS.S.unit}`)

  if (isNaN(Z_bottom))
    errors.push('池底标高 Z_bottom 不能为空')
  else if (Z_bottom < AG00_PARAM_LIMITS.Z_bottom.min || Z_bottom > AG00_PARAM_LIMITS.Z_bottom.max)
    errors.push(`池底标高 Z_bottom 应在 ${AG00_PARAM_LIMITS.Z_bottom.min}-${AG00_PARAM_LIMITS.Z_bottom.max} ${AG00_PARAM_LIMITS.Z_bottom.unit} 范围内`)

  if (isNaN(Z_top))
    errors.push('池顶标高 Z_top 不能为空')
  else if (Z_top < AG00_PARAM_LIMITS.Z_top.min || Z_top > AG00_PARAM_LIMITS.Z_top.max)
    errors.push(`池顶标高 Z_top 应在 ${AG00_PARAM_LIMITS.Z_top.min}-${AG00_PARAM_LIMITS.Z_top.max} ${AG00_PARAM_LIMITS.Z_top.unit} 范围内`)

  // 水位关系校验
  if (!isNaN(Z_bottom) && !isNaN(Z_top) && Z_bottom >= Z_top)
    errors.push(`池底标高 Z_bottom (${Z_bottom}) 应小于池顶标高 Z_top (${Z_top})`)

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      Q: null, Q_p: null, Q_single: null,
      i: null, ARF: null,
    }
  }

  // ── 步骤1：暴雨分析（IDF公式）──────────────────────────────

  const constants = IDF_CONSTANTS[zone][T]
  const i = constants.a / Math.pow(t_d + constants.b, constants.c)  // mm/h

  // ── 步骤2：径流估算（推理法）───────────────────────────────

  // 面积折减系数
  const ARF = A <= 25 ? 1.0 : 1.547 / (A + 280.11)

  // 峰值流量（m³/s）
  const Q_p = 0.278 * C * i * A * ARF

  // 总设计流量（m³/h）
  const Q = Q_p * 3600

  // 单泵流量
  const Q_single = Q / N

  // ── 校验 ──────────────────────────────────────────────────

  if (Q_single > 2000)
    warnings.push(`单泵流量 ${fmt(Q_single)} m³/h 偏大，请确认输入参数`)

  // ── 输出结果 ──────────────────────────────────────────────

  const rows = [
    stepRow('═══════════ 输入参数 ═══════════', '', '', ''),
    stepRow('暴雨分区 zone', `手册第4.3.2节`, zone, '', `选项：${Object.entries(AG00_PARAM_LIMITS.zone.labels).map(([k,v]) => `${k}=${v}`).join(', ')}`),
    stepRow('设计重现期 T', `手册第14.6.2节`, Number(T), '年', '选项：10/50/200年'),
    stepRow('暴雨历时 t_d', `手册第4.3.4节`, t_d, 'min', `范围：${AG00_PARAM_LIMITS.t_d.min}-${AG00_PARAM_LIMITS.t_d.max}`),
    stepRow('集水区面积 A', `手册第7.5.2节`, A, 'km²', `范围：${AG00_PARAM_LIMITS.A.min}-${AG00_PARAM_LIMITS.A.max}`),
    stepRow('径流系数 C', `手册表7.5.2`, C, '', `城市：0.85-0.95；乡村：0.20-0.50`),
    stepRow('工作泵台数 N', `手册第14.6.2节`, N, '台', `范围：${AG00_PARAM_LIMITS.N.min}-${AG00_PARAM_LIMITS.N.max}`),
    stepRow('集水池面积 S', '', S, 'm²', ''),
    stepRow('池底标高 Z_bottom', '', Z_bottom, 'mPD', ''),
    stepRow('池顶标高 Z_top', '', Z_top, 'mPD', ''),
    stepRow('═══════════ 步骤1：暴雨分析 ═══════════', '', '', ''),
    stepRow('IDF常数 a', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, constants.a.toFixed(3), ''),
    stepRow('IDF常数 b', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, constants.b.toFixed(3), ''),
    stepRow('IDF常数 c', `查表（${AG00_PARAM_LIMITS.zone.labels[zone]}）`, constants.c.toFixed(3), ''),
    stepRow('降雨强度 i', `a/(t_d+b)^c = ${constants.a}/${(t_d+constants.b).toFixed(1)}^${constants.c}`, i, 'mm/h'),
    stepRow('═══════════ 步骤2：径流估算 ═══════════', '', '', ''),
    stepRow('面积折减系数 ARF', A <= 25 ? 'A≤25km²→1.0' : '公式：1.547/(A+280.11)', ARF.toFixed(4), '', '手册第4.3.6节'),
    stepRow('峰值流量 Q_p', `0.278×C×i×A×ARF =`, Q_p, 'm³/s', '手册第7.5.2节'),
    stepRow('总设计流量 Q', `Q_p × 3600 =`, Q, 'm³/h'),
    stepRow('单泵流量 Q_single', `Q / N = ${fmt(Q)} / ${N} =`, Q_single, 'm³/h'),
  ]

  return {
    valid: true,
    errors,
    warnings,
    // 计算结果
    zone, T, t_d, A, C, ARF,
    i, Q_p, Q, Q_single, N, S,
    Z_bottom, Z_top,
    // 径流系数参考
    C_reference: C_REFERENCE_TABLE,
    // 输出给下游
    rows,
  }
}
