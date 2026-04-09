import { ceilTo01, fmt, stepRow } from '../utils.js'

/**
 * AG1-1：调蓄池计算
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第14章
 *
 * 步骤3：几何参数计算
 *   Z_top = Z_bottom + D
 *
 * 步骤7：调蓄演算与容积校验
 *   V_min = Q_pump / (4 × Z) × 3600
 *
 * 步骤6：水位控制设计
 *   Z_stop = Z_bottom
 *   Z_start1 = Z_stop + k1 × D
 *   Z_start2 = Z_stop + k2 × D
 *   Z_max = Z_top - F_b - F_s
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 输入参数（来自AG0-0）：
 *   V_design    设计水缸容量（m³）
 *   Z_bottom    池底标高（mPD）
 *   D           设计水缸深度（m）
 *   N           工作泵台数
 *   Z           每小时允许启动次数（次/小时）
 *   Q_pump      单泵设计流量（m³/s）
 *
 * 设计参数（带默认值，依据手册或工程惯例）：
 *   k1          1#泵启动水位系数（池深比例），默认值0.4375（案例调整）
 *   k2          2#泵启动水位系数（池深比例），默认值0.75（案例调整）
 *   F_b         超高（m），默认值0.8（≥0.8），手册第6.5节
 *   F_s         安全余量（m），默认值1.0，工程惯例
 *   h_alarm_offset 低水位报警偏移（m），默认值0.5，工程惯例
 * ─────────────────────────────────────────────────────────────────────────
 */

// 参数范围定义（用于校核）
export const POOL_DEPTH_LIMITS = {
  // 输入参数范围
  V_design:   { min: 100,   max: 500000, unit: 'm³',   label: '设计水缸容量' },
  Z_bottom:    { min: -50,   max: 10,     unit: 'mPD',  label: '池底标高' },
  D:           { min: 5,     max: 30,     unit: 'm',    label: '设计水缸深度' },
  N:           { min: 1,     max: 6,      unit: '台',    label: '工作泵台数', integer: true },
  Z:           { min: 4,     max: 12,     unit: '次/小时', label: '每小时允许启动次数', ref: '手册第14.6.1节' },
  Q_pump:      { min: 0.1,   max: 10,     unit: 'm³/s', label: '单泵流量' },
  // 设计参数范围
  k1:          { min: 0.40,  max: 0.50,   unit: '',      label: '1#泵启动水位系数', ref: '手册第14.6.1节' },
  k2:          { min: 0.75,  max: 0.85,   unit: '',      label: '2#泵启动水位系数', ref: '手册第14.6.1节' },
  F_b:         { min: 0.5,   max: 2.0,    unit: 'm',    label: '超高', ref: '设计参考' },
  F_s:         { min: 0.1,   max: 2.0,   unit: 'm',    label: '安全余量', ref: '工程惯例' },
  h_alarm_offset: { min: 0.3, max: 0.5,  unit: 'm',    label: '低水位报警偏移', ref: '工程惯例' },
}

/**
 * 校验参数是否在有效范围内
 * @returns {Array} 错误信息数组
 */
export function validatePoolDepthParams(params) {
  const errors = []
  const { V_design, Z_bottom, D, N, Z, Q_pump,
          k1, k2, F_b, F_s, h_alarm_offset } = params

  // 基础参数校验
  if (V_design !== undefined && (V_design < POOL_DEPTH_LIMITS.V_design.min || V_design > POOL_DEPTH_LIMITS.V_design.max))
    errors.push(`设计水缸容量 V_design 应在 ${POOL_DEPTH_LIMITS.V_design.min}-${POOL_DEPTH_LIMITS.V_design.max} ${POOL_DEPTH_LIMITS.V_design.unit} 范围内`)

  if (Z_bottom !== undefined && (Z_bottom < POOL_DEPTH_LIMITS.Z_bottom.min || Z_bottom > POOL_DEPTH_LIMITS.Z_bottom.max))
    errors.push(`池底标高 Z_bottom 应在 ${POOL_DEPTH_LIMITS.Z_bottom.min}-${POOL_DEPTH_LIMITS.Z_bottom.max} ${POOL_DEPTH_LIMITS.Z_bottom.unit} 范围内`)

  if (D !== undefined && (D < POOL_DEPTH_LIMITS.D.min || D > POOL_DEPTH_LIMITS.D.max))
    errors.push(`设计水缸深度 D 应在 ${POOL_DEPTH_LIMITS.D.min}-${POOL_DEPTH_LIMITS.D.max} ${POOL_DEPTH_LIMITS.D.unit} 范围内`)

  if (N !== undefined) {
    if (!Number.isInteger(N) || N < POOL_DEPTH_LIMITS.N.min || N > POOL_DEPTH_LIMITS.N.max)
      errors.push(`工作泵台数 N 应为 ${POOL_DEPTH_LIMITS.N.min}-${POOL_DEPTH_LIMITS.N.max} 之间的整数`)
  }

  if (Z !== undefined && (Z < POOL_DEPTH_LIMITS.Z.min || Z > POOL_DEPTH_LIMITS.Z.max))
    errors.push(`每小时允许启动次数 Z 应在 ${POOL_DEPTH_LIMITS.Z.min}-${POOL_DEPTH_LIMITS.Z.max} ${POOL_DEPTH_LIMITS.Z.unit} 范围内（${POOL_DEPTH_LIMITS.Z.ref}）`)

  if (Q_pump !== undefined && (Q_pump < POOL_DEPTH_LIMITS.Q_pump.min || Q_pump > POOL_DEPTH_LIMITS.Q_pump.max))
    errors.push(`单泵流量 Q_pump 应在 ${POOL_DEPTH_LIMITS.Q_pump.min}-${POOL_DEPTH_LIMITS.Q_pump.max} ${POOL_DEPTH_LIMITS.Q_pump.unit} 范围内`)

  // 设计参数校验
  if (k1 !== undefined && (k1 < POOL_DEPTH_LIMITS.k1.min || k1 > POOL_DEPTH_LIMITS.k1.max))
    errors.push(`1#泵启动水位系数 k1 应在 ${POOL_DEPTH_LIMITS.k1.min}-${POOL_DEPTH_LIMITS.k1.max} 范围内（${POOL_DEPTH_LIMITS.k1.ref}）`)

  if (k2 !== undefined && (k2 < POOL_DEPTH_LIMITS.k2.min || k2 > POOL_DEPTH_LIMITS.k2.max))
    errors.push(`2#泵启动水位系数 k2 应在 ${POOL_DEPTH_LIMITS.k2.min}-${POOL_DEPTH_LIMITS.k2.max} 范围内（${POOL_DEPTH_LIMITS.k2.ref}）`)

  if (F_b !== undefined && (F_b < POOL_DEPTH_LIMITS.F_b.min || F_b > POOL_DEPTH_LIMITS.F_b.max))
    errors.push(`超高 F_b 应在 ${POOL_DEPTH_LIMITS.F_b.min}-${POOL_DEPTH_LIMITS.F_b.max} ${POOL_DEPTH_LIMITS.F_b.unit} 范围内（${POOL_DEPTH_LIMITS.F_b.ref}）`)

  if (F_s !== undefined && (F_s < POOL_DEPTH_LIMITS.F_s.min || F_s > POOL_DEPTH_LIMITS.F_s.max))
    errors.push(`安全余量 F_s 应在 ${POOL_DEPTH_LIMITS.F_s.min}-${POOL_DEPTH_LIMITS.F_s.max} ${POOL_DEPTH_LIMITS.F_s.unit} 范围内（${POOL_DEPTH_LIMITS.F_s.ref}）`)

  if (h_alarm_offset !== undefined && (h_alarm_offset < POOL_DEPTH_LIMITS.h_alarm_offset.min || h_alarm_offset > POOL_DEPTH_LIMITS.h_alarm_offset.max))
    errors.push(`低水位报警偏移 h_alarm_offset 应在 ${POOL_DEPTH_LIMITS.h_alarm_offset.min}-${POOL_DEPTH_LIMITS.h_alarm_offset.max} ${POOL_DEPTH_LIMITS.h_alarm_offset.unit} 范围内（${POOL_DEPTH_LIMITS.h_alarm_offset.ref}）`)

  return errors
}

export function runPoolDepth({
  V_design,   // 设计水缸容量（m³）
  Z_bottom,   // 池底标高（mPD）
  D,          // 设计水缸深度（m）
  N,          // 工作泵台数
  Z,          // 每小时允许启动次数（次/小时）
  Q_pump,     // 单泵设计流量（m³/s）
  // 设计参数（带默认值，依据手册或工程惯例）
  k1 = 0.4375,       // 1#泵启动水位系数（池深比例），案例调整值
  k2 = 0.75,         // 2#泵启动水位系数（池深比例），案例调整值
  F_b = 1.3,         // 超高（m），最高水位距池顶的距离
  F_s = 0.5,         // 安全余量（m），高于启泵水位的安全超高
  h_alarm_offset = 0.5, // 低水位报警偏移（m），默认值依据工程惯例
}) {
  const rows = []
  const warnings = []

  // ── 参数校验 ──────────────────────────────────────────────
  const validationErrors = validatePoolDepthParams({
    V_design, Z_bottom, D, N, Z, Q_pump,
    k1, k2, F_b, F_s, h_alarm_offset
  })

  if (validationErrors.length > 0) {
    return {
      valid: false,
      errors: validationErrors,
      warnings,
      rows: validationErrors.map(e => stepRow('错误', '', e, '')),
    }
  }

  // ── 步骤3：几何参数计算 ──────────────────────────────────

  // 池顶标高 = 池底 + 深度
  const Z_top = Z_bottom + D

  // ── 步骤6：水位控制设计 ──────────────────────────────────

  // 主泵停泵水位 = 池底标高（mPD）
  // 集水坑积水由独立集水坑泵排走，与主泵系统无关
  const Z_stop = Z_bottom

  // 1#泵启动水位（mPD）
  const Z_start1 = Z_stop + k1 * D

  // 2#泵启动水位（mPD）
  const Z_start2 = Z_stop + k2 * D

  // 最高水位（mPD）
  const Z_max = Z_top - F_b - F_s

  // 报警水位（mPD）；低水位报警以池底为基准
  const Z_alarm_low = Z_bottom - h_alarm_offset
  const Z_alarm_high = Z_max - 0.3

  // ── 步骤7：调蓄演算与容积校验 ──────────────────────────────

  // 最小调节容积（由启动次数推算）
  // V_min = Q_pump / (4 × Z) × 3600
  // 来源：工程惯例值参考，当来水量等于泵流量一半时，启停最频繁
  const V_min = (Q_pump / (4 * Z)) * 3600

  // 有效调蓄容积 = 面积 × 有效深度
  // 有效深度 = 最高水位 - 停泵水位
  // 假设面积为 V_design / D（简化计算）
  const S = V_design / D  // 推算面积
  const V_effective = S * (Z_max - Z_stop)

  // 容积校验
  const V_ok = V_effective >= V_min

  // ── 设计参数标注 ──────────────────────────────────────────
  rows.push(stepRow('═══════════ 设计参数 ═══════════', '', '', ''))
  rows.push(stepRow('1#泵启动水位系数 k1', '案例调整值(原手册0.40-0.50)', k1, ''))
  rows.push(stepRow('2#泵启动水位系数 k2', '案例调整值(原手册0.75-0.85)', k2, ''))
  rows.push(stepRow('超高 F_b', '设计参考值', F_b, 'm'))
  rows.push(stepRow('安全余量 F_s', '高于启泵水位的安全超高', F_s, 'm'))
  rows.push(stepRow('低水位报警偏移 h_alarm_offset', '工程惯例默认值', h_alarm_offset, 'm'))
  rows.push(stepRow('每小时允许启动次数 Z', '泵参数限制', Z, '次/小时', '手册第14.6.1节'))

  rows.push(stepRow('═══════════ 步骤3：几何参数 ═══════════', '', '', ''))
  rows.push(stepRow('设计水缸容量 V_design', '用户输入', fmt(V_design, 0), 'm³'))
  rows.push(stepRow('设计水缸深度 D', '用户输入', fmt(D, 1), 'm'))
  rows.push(stepRow('池底标高 Z_bottom', '用户输入', fmt(Z_bottom, 2), 'mPD'))
  rows.push(stepRow('池顶标高 Z_top', `Z_bottom + D = ${fmt(Z_bottom)} + ${fmt(D)}`, fmt(Z_top, 2), 'mPD', '计算值'))
  rows.push(stepRow('推算面积 S', `V_design / D = ${fmt(V_design, 0)} / ${fmt(D)}`, fmt(S, 1), 'm²'))

  rows.push(stepRow('═══════════ 步骤6：水位控制 ═══════════', '', '', ''))
  rows.push(stepRow('停泵水位 Z_stop', `Z_stop = Z_bottom`, fmt(Z_stop, 2), 'mPD'))
  rows.push(stepRow('1#泵启动水位 Z_start1', `Z_stop + k1×D = ${fmt(Z_stop)} + ${k1}×${fmt(D)} =`, fmt(Z_start1, 2), 'mPD'))
  rows.push(stepRow('2#泵启动水位 Z_start2', `Z_stop + k2×D = ${fmt(Z_stop)} + ${k2}×${fmt(D)} =`, fmt(Z_start2, 2), 'mPD'))
  rows.push(stepRow('最高水位 Z_max', `Z_top - F_b - F_s = ${fmt(Z_top)} - ${F_b} - ${F_s} =`, fmt(Z_max, 2), 'mPD'))
  rows.push(stepRow('低水位报警 Z_alarm_low', `Z_bottom - h_alarm_offset = ${fmt(Z_bottom)} - ${h_alarm_offset} =`, fmt(Z_alarm_low, 2), 'mPD'))
  rows.push(stepRow('高水位报警 Z_alarm_high', `Z_max - 0.3 =`, fmt(Z_alarm_high, 2), 'mPD'))

  rows.push(stepRow('═══════════ 步骤7：容积校验 ═══════════', '', '', ''))
  rows.push(stepRow('单泵流量 Q_pump', '来自AG0-0', fmt(Q_pump, 3), 'm³/s'))
  rows.push(stepRow('最小调节容积 V_min', `Q_pump/(4×Z)×3600 = ${fmt(Q_pump)}/(4×${Z})×3600 =`, fmt(V_min, 1), 'm³', '工程惯例公式'))
  rows.push(stepRow('有效调蓄容积 V_effective', `S × (Z_max - Z_stop) = ${fmt(S)} × (${fmt(Z_max)} - ${fmt(Z_stop)}) =`, fmt(V_effective, 1), 'm³'))
  rows.push(stepRow('容积校验', V_ok ? '✓ 满足' : '✗ 不满足', `V_effective ≥ V_min：${fmt(V_effective)} ≥ ${fmt(V_min)}`, ''))

  // ── 水位关系校验 ──────────────────────────────────────────
  rows.push(stepRow('═══════════ 水位关系校验 ═══════════', '', '', ''))

  const waterLevelErrors = []
  if (Z_stop < Z_bottom) waterLevelErrors.push(`Z_stop(${fmt(Z_stop)}) < Z_bottom(${fmt(Z_bottom)})`)
  if (Z_start1 <= Z_stop) waterLevelErrors.push(`Z_start1(${fmt(Z_start1)}) <= Z_stop(${fmt(Z_stop)})`)
  if (Z_start2 <= Z_start1) waterLevelErrors.push(`Z_start2(${fmt(Z_start2)}) <= Z_start1(${fmt(Z_start1)})`)
  if (Z_max >= Z_top - 0.01) waterLevelErrors.push(`Z_max(${fmt(Z_max)}) >= Z_top(${fmt(Z_top)})`)

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
    V_min, V_effective, V_ok, S,
    D, Z_top,
    Z_stop, Z_start1, Z_start2, Z_max,
    Z_alarm_low, Z_alarm_high,
    Z,
    startLevels,
    // 固定分项（带依据标注）
    designParams: {
      k1:         { value: k1,         unit: '',       ref: '案例调整' },
      k2:         { value: k2,         unit: '',       ref: '案例调整' },
      F_b:        { value: F_b,        unit: 'm',       ref: '设计参考' },
      F_s:        { value: F_s,        unit: 'm',       ref: '高于启泵水位的安全超高' },
      h_alarm_offset: { value: h_alarm_offset, unit: 'm', ref: '工程惯例' },
      Z:          { value: Z,          unit: '次/小时', ref: '泵参数限制' },
    },
    // 输出给下游
    rows,
  }
}
