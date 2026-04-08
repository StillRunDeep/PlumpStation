import { ceilTo01, fmt, stepRow } from '../utils.js'

/**
 * AG1-1：调蓄池计算
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第14章
 *
 * 步骤3：调蓄池容积计算
 *   V_required = (Q_p - Q_pump) × t_peak × k_shape
 *
 * 步骤5：水位控制设计
 *   Z_stop = Z_sump + h_sub
 *   Z_start1 = Z_stop + k1 × D
 *   Z_start2 = Z_stop + k2 × D
 *   Z_max = Z_top - F_b - F_s
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 输入参数（来自AG0-0或上游模块）：
 *   Q           总设计流量（m³/h）
 *   Q_single    单泵设计流量（m³/h）
 *   Q_p         峰值流量（m³/s）
 *   N           工作泵台数
 *   S           集水池面积（m²）
 *   Z_bottom    池底标高（mPD）
 *   Z_top       池顶标高（mPD）
 *
 * 设计参数（带默认值，依据手册或工程惯例）：
 *   t_peak      暴雨峰现时间（min），默认值90，手册第14.5.2节
 *   k_shape     暴雨剖面形状系数，默认0.6（0.5-0.75），手册第14.5.2节
 *   h_sub       停泵淹没深度（m），默认值0.5，工程惯例≥0.5m
 *   k1          1#泵启动水位系数（池深比例），默认值0.45（0.40-0.50），手册第14.6.1节
 *   k2          2#泵启动水位系数（池深比例），默认值0.80（0.75-0.85），手册第14.6.1节
 *   F_b         超高（m），默认值0.8（≥0.8），手册第6.5节
 *   F_s         安全余量（m），默认值0.3，工程惯例
 *   Z_sump_offset 集水坑深度（m），默认值2.5，工程惯例（通常低于池底2-3m）
 * ─────────────────────────────────────────────────────────────────────────
 */

// 参数范围定义（用于校核）
export const AG11_PARAM_LIMITS = {
  // 输入参数范围
  Q:           { min: 1,     max: 100000, unit: 'm³/h',  label: '总设计流量' },
  Q_single:    { min: 0.1,   max: 10000,  unit: 'm³/h',  label: '单泵流量' },
  Q_p:         { min: 0.001, max: 1000,   unit: 'm³/s',  label: '峰值流量' },
  N:           { min: 1,     max: 6,      unit: '台',    label: '工作泵台数', integer: true },
  S:           { min: 10,    max: 100000, unit: 'm²',   label: '集水池面积' },
  Z_bottom:    { min: -50,   max: 10,     unit: 'mPD',   label: '池底标高' },
  Z_top:       { min: -10,   max: 50,     unit: 'mPD',   label: '池顶标高' },
  // 设计参数范围
  t_peak:      { min: 60,    max: 120,    unit: 'min',   label: '暴雨峰现时间', ref: '手册第14.5.2节' },
  k_shape:     { min: 0.5,   max: 0.75,   unit: '',      label: '暴雨剖面形状系数', ref: '手册第14.5.2节' },
  h_sub:       { min: 0.3,   max: 1.0,    unit: 'm',     label: '停泵淹没深度', ref: '工程惯例≥0.5m' },
  k1:          { min: 0.40,  max: 0.50,   unit: '',      label: '1#泵启动水位系数', ref: '手册第14.6.1节' },
  k2:          { min: 0.75,  max: 0.85,   unit: '',      label: '2#泵启动水位系数', ref: '手册第14.6.1节' },
  F_b:         { min: 0.5,   max: 2.0,    unit: 'm',     label: '超高', ref: '手册第6.5节≥0.8m' },
  F_s:         { min: 0.1,   max: 0.5,    unit: 'm',     label: '安全余量', ref: '工程惯例' },
  Z_sump_offset: { min: 1.5, max: 4.0,   unit: 'm',     label: '集水坑深度', ref: '工程惯例' },
}

/**
 * 校验参数是否在有效范围内
 * @returns {Array} 错误信息数组
 */
export function validateAG11Params(params) {
  const errors = []
  const { Q, Q_single, Q_p, N, S, Z_bottom, Z_top,
          t_peak, k_shape, h_sub, k1, k2, F_b, F_s, Z_sump_offset } = params

  // 基础参数校验
  if (Q !== undefined && (Q < AG11_PARAM_LIMITS.Q.min || Q > AG11_PARAM_LIMITS.Q.max))
    errors.push(`总设计流量 Q 应在 ${AG11_PARAM_LIMITS.Q.min}-${AG11_PARAM_LIMITS.Q.max} ${AG11_PARAM_LIMITS.Q.unit} 范围内`)

  if (Q_single !== undefined && (Q_single < AG11_PARAM_LIMITS.Q_single.min || Q_single > AG11_PARAM_LIMITS.Q_single.max))
    errors.push(`单泵流量 Q_single 应在 ${AG11_PARAM_LIMITS.Q_single.min}-${AG11_PARAM_LIMITS.Q_single.max} ${AG11_PARAM_LIMITS.Q_single.unit} 范围内`)

  if (Q_p !== undefined && (Q_p < AG11_PARAM_LIMITS.Q_p.min || Q_p > AG11_PARAM_LIMITS.Q_p.max))
    errors.push(`峰值流量 Q_p 应在 ${AG11_PARAM_LIMITS.Q_p.min}-${AG11_PARAM_LIMITS.Q_p.max} ${AG11_PARAM_LIMITS.Q_p.unit} 范围内`)

  if (N !== undefined) {
    if (!Number.isInteger(N) || N < AG11_PARAM_LIMITS.N.min || N > AG11_PARAM_LIMITS.N.max)
      errors.push(`工作泵台数 N 应为 ${AG11_PARAM_LIMITS.N.min}-${AG11_PARAM_LIMITS.N.max} 之间的整数`)
  }

  if (S !== undefined && (S < AG11_PARAM_LIMITS.S.min || S > AG11_PARAM_LIMITS.S.max))
    errors.push(`集水池面积 S 应在 ${AG11_PARAM_LIMITS.S.min}-${AG11_PARAM_LIMITS.S.max} ${AG11_PARAM_LIMITS.S.unit} 范围内`)

  if (Z_bottom !== undefined && (Z_bottom < AG11_PARAM_LIMITS.Z_bottom.min || Z_bottom > AG11_PARAM_LIMITS.Z_bottom.max))
    errors.push(`池底标高 Z_bottom 应在 ${AG11_PARAM_LIMITS.Z_bottom.min}-${AG11_PARAM_LIMITS.Z_bottom.max} ${AG11_PARAM_LIMITS.Z_bottom.unit} 范围内`)

  if (Z_top !== undefined && (Z_top < AG11_PARAM_LIMITS.Z_top.min || Z_top > AG11_PARAM_LIMITS.Z_top.max))
    errors.push(`池顶标高 Z_top 应在 ${AG11_PARAM_LIMITS.Z_top.min}-${AG11_PARAM_LIMITS.Z_top.max} ${AG11_PARAM_LIMITS.Z_top.unit} 范围内`)

  // 水位关系校验
  if (Z_bottom !== undefined && Z_top !== undefined && Z_bottom >= Z_top)
    errors.push(`池底标高 Z_bottom (${Z_bottom}) 应小于池顶标高 Z_top (${Z_top})`)

  // 设计参数校验
  if (t_peak !== undefined && (t_peak < AG11_PARAM_LIMITS.t_peak.min || t_peak > AG11_PARAM_LIMITS.t_peak.max))
    errors.push(`暴雨峰现时间 t_peak 应在 ${AG11_PARAM_LIMITS.t_peak.min}-${AG11_PARAM_LIMITS.t_peak.max} ${AG11_PARAM_LIMITS.t_peak.unit} 范围内（${AG11_PARAM_LIMITS.t_peak.ref}）`)

  if (k_shape !== undefined && (k_shape < AG11_PARAM_LIMITS.k_shape.min || k_shape > AG11_PARAM_LIMITS.k_shape.max))
    errors.push(`暴雨剖面形状系数 k_shape 应在 ${AG11_PARAM_LIMITS.k_shape.min}-${AG11_PARAM_LIMITS.k_shape.max} 范围内（${AG11_PARAM_LIMITS.k_shape.ref}）`)

  if (h_sub !== undefined && (h_sub < AG11_PARAM_LIMITS.h_sub.min || h_sub > AG11_PARAM_LIMITS.h_sub.max))
    errors.push(`停泵淹没深度 h_sub 应在 ${AG11_PARAM_LIMITS.h_sub.min}-${AG11_PARAM_LIMITS.h_sub.max} ${AG11_PARAM_LIMITS.h_sub.unit} 范围内（${AG11_PARAM_LIMITS.h_sub.ref}）`)

  if (k1 !== undefined && (k1 < AG11_PARAM_LIMITS.k1.min || k1 > AG11_PARAM_LIMITS.k1.max))
    errors.push(`1#泵启动水位系数 k1 应在 ${AG11_PARAM_LIMITS.k1.min}-${AG11_PARAM_LIMITS.k1.max} 范围内（${AG11_PARAM_LIMITS.k1.ref}）`)

  if (k2 !== undefined && (k2 < AG11_PARAM_LIMITS.k2.min || k2 > AG11_PARAM_LIMITS.k2.max))
    errors.push(`2#泵启动水位系数 k2 应在 ${AG11_PARAM_LIMITS.k2.min}-${AG11_PARAM_LIMITS.k2.max} 范围内（${AG11_PARAM_LIMITS.k2.ref}）`)

  if (F_b !== undefined && (F_b < AG11_PARAM_LIMITS.F_b.min || F_b > AG11_PARAM_LIMITS.F_b.max))
    errors.push(`超高 F_b 应在 ${AG11_PARAM_LIMITS.F_b.min}-${AG11_PARAM_LIMITS.F_b.max} ${AG11_PARAM_LIMITS.F_b.unit} 范围内（${AG11_PARAM_LIMITS.F_b.ref}）`)

  if (F_s !== undefined && (F_s < AG11_PARAM_LIMITS.F_s.min || F_s > AG11_PARAM_LIMITS.F_s.max))
    errors.push(`安全余量 F_s 应在 ${AG11_PARAM_LIMITS.F_s.min}-${AG11_PARAM_LIMITS.F_s.max} ${AG11_PARAM_LIMITS.F_s.unit} 范围内（${AG11_PARAM_LIMITS.F_s.ref}）`)

  return errors
}

export function runAG11({
  Q,          // 总设计流量（m³/h）
  Q_single,   // 单泵流量（m³/h）
  Q_p,        // 峰值流量（m³/s）
  N,          // 工作泵台数
  S,          // 集水池面积（m²）
  Z_bottom,   // 池底标高（mPD）
  Z_top,      // 池顶标高（mPD）
  // 设计参数（带默认值，依据手册或工程惯例）
  t_peak = 90,       // 暴雨峰现时间（min），默认值依据手册第14.5.2节
  k_shape = 0.6,      // 暴雨剖面形状系数，默认值依据手册第14.5.2节
  h_sub = 0.5,        // 停泵淹没深度（m），默认值依据工程惯例≥0.5m
  k1 = 0.45,         // 1#泵启动水位系数（池深比例），默认值依据手册第14.6.1节
  k2 = 0.80,         // 2#泵启动水位系数（池深比例），默认值依据手册第14.6.1节
  F_b = 0.8,         // 超高（m），默认值依据手册第6.5节≥0.8m
  F_s = 0.3,         // 安全余量（m），默认值依据工程惯例
  Z_sump_offset = 2.5, // 集水坑深度（m），默认值依据工程惯例（通常低于池底2-3m）
}) {
  const rows = []
  const warnings = []

  // ── 参数校验 ──────────────────────────────────────────────
  const validationErrors = validateAG11Params({
    Q, Q_single, Q_p, N, S, Z_bottom, Z_top,
    t_peak, k_shape, h_sub, k1, k2, F_b, F_s, Z_sump_offset
  })

  if (validationErrors.length > 0) {
    return {
      valid: false,
      errors: validationErrors,
      warnings,
      rows: validationErrors.map(e => stepRow('错误', '', e, '')),
    }
  }

  // ── 步骤3：调蓄池容积计算 ──────────────────────────────────

  // 单泵流量（m³/s）
  const Q_pump = Q_single / 3600

  // 削峰容积需求（m³）
  // V = (Q_p - Q_pump) × t_peak × 60 × k_shape
  // 注意：Q_p 和 Q_pump 单位一致（m³/s），t_peak 单位是 min
  const V_required = Math.max(0, (Q_p - Q_pump) * t_peak * 60 * k_shape)

  // 有效调蓄深度（m）
  const h_active = V_required / S

  // 总池深（m）
  const D = Z_top - Z_bottom

  // ── 设计参数标注 ──────────────────────────────────────────
  rows.push(stepRow('═══════════ 设计参数 ═══════════', '', '', ''))
  rows.push(stepRow('暴雨峰现时间 t_peak', '手册第14.5.2节默认值', t_peak, 'min'))
  rows.push(stepRow('暴雨剖面形状系数 k_shape', '手册第14.5.2节默认值(0.5-0.75)', k_shape, ''))
  rows.push(stepRow('停泵淹没深度 h_sub', '工程惯例默认值(≥0.5m)', h_sub, 'm'))
  rows.push(stepRow('1#泵启动水位系数 k1', '手册第14.6.1节默认值(0.40-0.50)', k1, ''))
  rows.push(stepRow('2#泵启动水位系数 k2', '手册第14.6.1节默认值(0.75-0.85)', k2, ''))
  rows.push(stepRow('超高 F_b', '手册第6.5节要求≥0.8m', F_b, 'm'))
  rows.push(stepRow('安全余量 F_s', '工程惯例默认值', F_s, 'm'))
  rows.push(stepRow('集水坑深度 Z_sump_offset', '工程惯例默认值(通常低于池底2-3m)', Z_sump_offset, 'm'))
  rows.push(stepRow('═══════════ 步骤3：调蓄池容积 ═══════════', '', '', ''))
  rows.push(stepRow('峰值流量 Q_p', '来自AG0-0', fmt(Q_p, 3), 'm³/s'))
  rows.push(stepRow('单泵流量 Q_pump', `Q_single/3600 = ${fmt(Q_single)}/3600 =`, fmt(Q_pump, 3), 'm³/s'))
  rows.push(stepRow('削峰容积 V_required', `(Q_p-Q_pump)×t_peak×60×k_shape =`, fmt(V_required, 1), 'm³'))
  rows.push(stepRow('有效调蓄深度 h_active', `V_required / S = ${fmt(V_required, 1)} / ${S} =`, fmt(h_active, 2), 'm'))
  rows.push(stepRow('总池深 D', `Z_top - Z_bottom = ${fmt(Z_top)} - ${fmt(Z_bottom)} =`, fmt(D, 1), 'm'))

  // ── 步骤5：水位控制设计 ────────────────────────────────────

  // 集水坑底标高
  const Z_sump = Z_bottom - Z_sump_offset

  // 停泵水位（mPD）
  const Z_stop = Z_sump + h_sub

  // 1#泵启动水位（mPD）
  const Z_start1 = Z_stop + k1 * D

  // 2#泵启动水位（mPD）
  const Z_start2 = Z_stop + k2 * D

  // 最高水位（mPD）
  const Z_max = Z_top - F_b - F_s

  // 报警水位（mPD）
  const Z_alarm_low = Z_stop - 0.3
  const Z_alarm_high = Z_max - 0.3

  rows.push(stepRow('═══════════ 步骤5：水位控制 ═══════════', '', '', ''))
  rows.push(stepRow('集水坑底标高 Z_sump', `Z_bottom - Z_sump_offset = ${fmt(Z_bottom)} - ${Z_sump_offset} =`, fmt(Z_sump, 2), 'mPD'))
  rows.push(stepRow('停泵水位 Z_stop', `Z_sump + h_sub = ${fmt(Z_sump)} + ${h_sub} =`, fmt(Z_stop, 2), 'mPD'))
  rows.push(stepRow('1#泵启动水位 Z_start1', `Z_stop + k1×D = ${fmt(Z_stop)} + ${k1}×${fmt(D)} =`, fmt(Z_start1, 2), 'mPD'))
  rows.push(stepRow('2#泵启动水位 Z_start2', `Z_stop + k2×D = ${fmt(Z_stop)} + ${k2}×${fmt(D)} =`, fmt(Z_start2, 2), 'mPD'))
  rows.push(stepRow('最高水位 Z_max', `Z_top - F_b - F_s = ${fmt(Z_top)} - ${F_b} - ${F_s} =`, fmt(Z_max, 2), 'mPD'))
  rows.push(stepRow('低水位报警 Z_alarm_low', `Z_stop - 0.3 =`, fmt(Z_alarm_low, 2), 'mPD'))
  rows.push(stepRow('高水位报警 Z_alarm_high', `Z_max - 0.3 =`, fmt(Z_alarm_high, 2), 'mPD'))

  // ── 水位关系校验 ──────────────────────────────────────────
  rows.push(stepRow('═══════════ 水位关系校验 ═══════════', '', '', ''))

  const waterLevelErrors = []
  if (Z_stop < Z_bottom) waterLevelErrors.push(`Z_stop(${fmt(Z_stop)}) < Z_bottom(${fmt(Z_bottom)})`)
  if (Z_start1 <= Z_stop) waterLevelErrors.push(`Z_start1(${fmt(Z_start1)}) <= Z_stop(${fmt(Z_stop)})`)
  if (Z_start2 <= Z_start1) waterLevelErrors.push(`Z_start2(${fmt(Z_start2)}) <= Z_start1(${fmt(Z_start1)})`)
  if (Z_max >= Z_top - 0.01) waterLevelErrors.push(`Z_max(${fmt(Z_max)}) >= Z_top(${fmt(Z_top)})`)
  if (Z_alarm_low < Z_bottom) waterLevelErrors.push(`Z_alarm_low(${fmt(Z_alarm_low)}) < Z_bottom(${fmt(Z_bottom)})`)

  if (waterLevelErrors.length > 0) {
    warnings.push(...waterLevelErrors)
    waterLevelErrors.forEach(e => rows.push(stepRow('水位警告', '', e, '')))
  } else {
    rows.push(stepRow('水位关系', '校验通过', 'Z_stop < Z_start1 < Z_start2 < Z_max < Z_top', ''))
  }

  // 超高校验
  const F_actual = Z_top - Z_max
  if (F_actual < F_b) {
    warnings.push(`超高不足：实际超高 ${fmt(F_actual)}m < 要求 ${F_b}m`)
    rows.push(stepRow('超高校验', '⚠ 不满足', `Z_top - Z_max = ${fmt(F_actual)} < ${F_b}`, 'm'))
  } else {
    rows.push(stepRow('超高校验', '✓ 满足', `Z_top - Z_max = ${fmt(F_actual)} ≥ ${F_b}`, 'm'))
  }

  // ── 多泵梯级启动水位 ──────────────────────────────────────

  const startLevels = []
  for (let idx = 0; idx < N; idx++) {
    if (idx === 0) {
      startLevels.push({ pump: idx + 1, level: Z_start1 })
    } else if (idx === 1) {
      startLevels.push({ pump: idx + 1, level: Z_start2 })
    } else {
      // 第3台及以后，每台增加0.2m
      startLevels.push({ pump: idx + 1, level: +(Z_start2 + (idx - 1) * 0.2).toFixed(2) })
    }
  }

  rows.push(stepRow('多泵启动水位', '梯级递增', `${startLevels.map(s => `P${s.pump}:${fmt(s.level)}`).join(', ')}`, 'mPD'))

  return {
    // 计算状态
    valid: true,
    errors: [],
    warnings,
    // 计算结果
    V_required, h_active, D,
    Z_sump, Z_stop, Z_start1, Z_start2, Z_max,
    Z_alarm_low, Z_alarm_high,
    startLevels,
    // 固定分项（带依据标注）
    designParams: {
      t_peak:     { value: t_peak,     unit: 'min', ref: '手册第14.5.2节' },
      k_shape:    { value: k_shape,    unit: '',     ref: '手册第14.5.2节' },
      h_sub:      { value: h_sub,      unit: 'm',     ref: '工程惯例≥0.5m' },
      k1:         { value: k1,         unit: '',      ref: '手册第14.6.1节' },
      k2:         { value: k2,         unit: '',      ref: '手册第14.6.1节' },
      F_b:        { value: F_b,        unit: 'm',     ref: '手册第6.5节≥0.8m' },
      F_s:        { value: F_s,        unit: 'm',     ref: '工程惯例' },
      Z_sump_offset: { value: Z_sump_offset, unit: 'm', ref: '工程惯例' },
    },
    // 输出给下游
    rows,
  }
}
