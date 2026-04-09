import { selectDN, fmt, stepRow } from '../utils.js'

/**
 * AG1-3：管道尺寸计算与水力校核
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第8章、第14章
 *
 * 步骤6a：管道尺寸计算
 *   D_calc = sqrt(4 × Q_vol / (π × v)) × 1000  (mm)
 *   DN = ceil_to_DN_series(D_calc)
 *
 * 步骤6b：水力校核
 *   H_f = 10.29 × n² × L × Q² / D^5.33  (m)
 *   NPSH_a ≥ NPSH_r + 0.5  (m)
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 输入参数（来自AG1-2或AG0-0）：
 *   Q_pump        单泵设计流量（m³/s），来自AG1-2
 *   H_total       总扬程（m），来自AG1-2
 *   Q             泵站总流量（m³/h），来自AG0-0
 *   N             工作泵台数，来自AG0-0
 *
 * 设计参数（带默认值，依据手册或工程惯例）：
 *   v_in          泵进水管设计流速（m/s），默认1.0，手册第8.3节
 *   v_out         泵出水管设计流速（m/s），默认1.5，经济流速
 *   n             曼宁粗糙系数，默认0.013（混凝土管），手册第8.3节
 *   k_local       局部损失系数，默认0.15，沿程损失的15%
 *   NPSH_r        必需汽蚀余量（m），默认3.0，工程惯例
 *   L             管长（m），默认50，工程惯例
 * ─────────────────────────────────────────────────────────────────────────
 */

// 参数范围定义
export const AG13_PARAM_LIMITS = {
  // 输入参数范围
  Q_pump:      { min: 0.001, max: 100,   unit: 'm³/s', label: '单泵设计流量' },
  H_total:     { min: 1,     max: 50,    unit: 'm',    label: '总扬程' },
  Q:           { min: 1,     max: 100000, unit: 'm³/h', label: '泵站总流量' },
  N:           { min: 1,     max: 6,     unit: '台',   label: '工作泵台数', integer: true },
  // 设计参数范围
  v_in:        { min: 0.6,   max: 1.5,   unit: 'm/s',  label: '泵进水管设计流速', ref: '手册第8.3节' },
  v_out:       { min: 1.0,   max: 2.5,   unit: 'm/s',  label: '泵出水管设计流速', ref: '经济流速' },
  n:           { min: 0.010, max: 0.020, unit: 's/m^(1/3)', label: '曼宁粗糙系数', ref: '手册第8.3节' },
  k_local:     { min: 0.05,  max: 0.30,  unit: '',     label: '局部损失系数', ref: '工程惯例' },
  NPSH_r:      { min: 1.0,   max: 8.0,   unit: 'm',    label: '必需汽蚀余量', ref: '工程惯例' },
  L:           { min: 5,     max: 500,   unit: 'm',    label: '管长', ref: '工程惯例' },
}

/**
 * 校验AG1-3参数是否在有效范围内
 * @returns {Array} 错误信息数组
 */
export function validateAG13Params(params) {
  const errors = []
  const { Q_pump, H_total, Q, N, v_in, v_out, n, k_local, NPSH_r, L } = params

  if (Q_pump !== undefined && (Q_pump < AG13_PARAM_LIMITS.Q_pump.min || Q_pump > AG13_PARAM_LIMITS.Q_pump.max))
    errors.push(`单泵流量 Q_pump 应在 ${AG13_PARAM_LIMITS.Q_pump.min}-${AG13_PARAM_LIMITS.Q_pump.max} ${AG13_PARAM_LIMITS.Q_pump.unit} 范围内`)

  if (H_total !== undefined && (H_total < AG13_PARAM_LIMITS.H_total.min || H_total > AG13_PARAM_LIMITS.H_total.max))
    errors.push(`总扬程 H_total 应在 ${AG13_PARAM_LIMITS.H_total.min}-${AG13_PARAM_LIMITS.H_total.max} ${AG13_PARAM_LIMITS.H_total.unit} 范围内`)

  if (Q !== undefined && (Q < AG13_PARAM_LIMITS.Q.min || Q > AG13_PARAM_LIMITS.Q.max))
    errors.push(`泵站总流量 Q 应在 ${AG13_PARAM_LIMITS.Q.min}-${AG13_PARAM_LIMITS.Q.max} ${AG13_PARAM_LIMITS.Q.unit} 范围内`)

  if (N !== undefined) {
    if (!Number.isInteger(N) || N < AG13_PARAM_LIMITS.N.min || N > AG13_PARAM_LIMITS.N.max)
      errors.push(`工作泵台数 N 应为 ${AG13_PARAM_LIMITS.N.min}-${AG13_PARAM_LIMITS.N.max} 之间的整数`)
  }

  if (v_in !== undefined && (v_in < AG13_PARAM_LIMITS.v_in.min || v_in > AG13_PARAM_LIMITS.v_in.max))
    errors.push(`泵进水管设计流速 v_in 应在 ${AG13_PARAM_LIMITS.v_in.min}-${AG13_PARAM_LIMITS.v_in.max} ${AG13_PARAM_LIMITS.v_in.unit} 范围内（${AG13_PARAM_LIMITS.v_in.ref}）`)

  if (v_out !== undefined && (v_out < AG13_PARAM_LIMITS.v_out.min || v_out > AG13_PARAM_LIMITS.v_out.max))
    errors.push(`泵出水管设计流速 v_out 应在 ${AG13_PARAM_LIMITS.v_out.min}-${AG13_PARAM_LIMITS.v_out.max} ${AG13_PARAM_LIMITS.v_out.unit} 范围内（${AG13_PARAM_LIMITS.v_out.ref}）`)

  if (n !== undefined && (n < AG13_PARAM_LIMITS.n.min || n > AG13_PARAM_LIMITS.n.max))
    errors.push(`曼宁粗糙系数 n 应在 ${AG13_PARAM_LIMITS.n.min}-${AG13_PARAM_LIMITS.n.max} 范围内（${AG13_PARAM_LIMITS.n.ref}）`)

  if (k_local !== undefined && (k_local < AG13_PARAM_LIMITS.k_local.min || k_local > AG13_PARAM_LIMITS.k_local.max))
    errors.push(`局部损失系数 k_local 应在 ${AG13_PARAM_LIMITS.k_local.min}-${AG13_PARAM_LIMITS.k_local.max} 范围内（${AG13_PARAM_LIMITS.k_local.ref}）`)

  if (NPSH_r !== undefined && (NPSH_r < AG13_PARAM_LIMITS.NPSH_r.min || NPSH_r > AG13_PARAM_LIMITS.NPSH_r.max))
    errors.push(`必需汽蚀余量 NPSH_r 应在 ${AG13_PARAM_LIMITS.NPSH_r.min}-${AG13_PARAM_LIMITS.NPSH_r.max} ${AG13_PARAM_LIMITS.NPSH_r.unit} 范围内（${AG13_PARAM_LIMITS.NPSH_r.ref}）`)

  if (L !== undefined && (L < AG13_PARAM_LIMITS.L.min || L > AG13_PARAM_LIMITS.L.max))
    errors.push(`管长 L 应在 ${AG13_PARAM_LIMITS.L.min}-${AG13_PARAM_LIMITS.L.max} ${AG13_PARAM_LIMITS.L.unit} 范围内（${AG13_PARAM_LIMITS.L.ref}）`)

  return errors
}

/**
 * AG1-3：管道尺寸计算与水力校核
 *
 * @param {Object} params - 输入参数
 * @param {number} params.Q_pump - 单泵设计流量（m³/s）
 * @param {number} params.Q - 泵站总流量（m³/h）
 * @param {number} params.N - 工作泵台数
 * @param {number} params.H_total - 总扬程（m），来自AG1-2
 * @param {number} params.Z_stop - 停泵水位（mPD），用于NPSH计算
 * @param {number} params.H_s - 淹没深度（m），主泵进口以上水柱高度，取固定值2.0m
 * @param {number} [params.v_in=1.0] - 泵进水管设计流速（m/s）
 * @param {number} [params.v_out=1.5] - 泵出水管设计流速（m/s）
 * @param {number} [params.n=0.013] - 曼宁粗糙系数
 * @param {number} [params.k_local=0.15] - 局部损失系数
 * @param {number} [params.NPSH_r=3.0] - 必需汽蚀余量（m）
 * @param {number} [params.L=50] - 管长（m）
 * @returns {Object} 计算结果
 */
export function runAG13({
  Q_pump,      // 单泵设计流量（m³/s）
  Q,           // 泵站总流量（m³/h）
  N,           // 工作泵台数
  H_total,     // 总扬程（m）
  Z_stop,      // 停泵水位（mPD）
  H_s = 2.0,   // 淹没深度（m），主泵进口以上水柱高度
  v_in = 1.0,   // 泵进水管设计流速（m/s），默认值依据手册第8.3节
  v_out = 1.5,  // 泵出水管设计流速（m/s），默认值依据经济流速
  n = 0.013,   // 曼宁粗糙系数（混凝土管），默认值依据手册第8.3节
  k_local = 0.15, // 局部损失系数，默认值依据工程惯例
  NPSH_r = 3.0, // 必需汽蚀余量（m），默认值依据工程惯例
  L = 50,      // 管长（m），默认值依据工程惯例
}) {
  const rows = []
  const warnings = []

  // ── 参数校验 ──────────────────────────────────────────────
  const validationErrors = validateAG13Params({
    Q_pump, Q, N, H_total, v_in, v_out, n, k_local, NPSH_r, L
  })

  if (validationErrors.length > 0) {
    return {
      valid: false,
      errors: validationErrors,
      warnings,
      rows: validationErrors.map(e => stepRow('错误', '', e, '')),
    }
  }

  // ── 设计参数标注 ──────────────────────────────────────────
  rows.push(stepRow('═══════════ 设计参数 ═══════════', '', '', ''))
  rows.push(stepRow('泵进水管设计流速 v_in', '手册第8.3节(防汽蚀)', v_in, 'm/s'))
  rows.push(stepRow('泵出水管设计流速 v_out', '经济流速', v_out, 'm/s'))
  rows.push(stepRow('曼宁粗糙系数 n', '手册第8.3节(混凝土管)', n, 's/m^(1/3)'))
  rows.push(stepRow('局部损失系数 k_local', '工程惯例默认值', k_local, ''))
  rows.push(stepRow('必需汽蚀余量 NPSH_r', '工程惯例典型值', NPSH_r, 'm'))
  rows.push(stepRow('管长 L', '工程惯例默认值', L, 'm'))

  // ── 步骤6a：管道尺寸计算 ─────────────────────────────────

  rows.push(stepRow('═══════════ 步骤6a：管道尺寸 ═══════════', '', '', ''))

  // 6.1 PumpInlet 管径（吸水管，每台泵独立）
  // D = sqrt(4 × Q_pump / (π × v_in)) × 1000
  const D_pumpIn_calc = Math.sqrt(4 * Q_pump / (Math.PI * v_in)) * 1000
  const DN_pumpIn = selectDN(D_pumpIn_calc)

  rows.push(stepRow('泵进水管计算内径 D_pumpIn', `√(4×Q_pump/π×v_in)×1000 =`, fmt(D_pumpIn_calc, 1), 'mm'))
  rows.push(stepRow('泵进水管公称直径 DN_pumpIn', '向上取标准系列', `DN${DN_pumpIn}`, 'mm'))

  // 6.2 PumpOutlet 管径（压水管，每台泵独立）
  const D_pumpOut_calc = Math.sqrt(4 * Q_pump / (Math.PI * v_out)) * 1000
  const DN_pumpOut = selectDN(D_pumpOut_calc)

  rows.push(stepRow('泵出水管计算内径 D_pumpOut', `√(4×Q_pump/π×v_out)×1000 =`, fmt(D_pumpOut_calc, 1), 'mm'))
  rows.push(stepRow('泵出水管公称直径 DN_pumpOut', '向上取标准系列', `DN${DN_pumpOut}`, 'mm'))

  // 6.3 MainOutlet 管径（总出水干管）
  const q_total = Q / 3600  // 总流量 m³/s
  const D_mainOutlet_calc = Math.sqrt(4 * q_total / (Math.PI * v_out)) * 1000
  const DN_mainOutlet = selectDN(D_mainOutlet_calc)

  rows.push(stepRow('总出水管计算流量 q_total', `Q / 3600 = ${Q} / 3600 =`, fmt(q_total, 3), 'm³/s'))
  rows.push(stepRow('总出水管计算内径 D_mainOutlet', `√(4×q_total/π×v_out)×1000 =`, fmt(D_mainOutlet_calc, 1), 'mm'))
  rows.push(stepRow('总出水管公称直径 DN_mainOutlet', '向上取标准系列', `DN${DN_mainOutlet}`, 'mm'))

  // ── 步骤6b：水力校核 ─────────────────────────────────────

  rows.push(stepRow('═══════════ 步骤6b：水力校核 ═══════════', '', '', ''))

  // 6.4 沿程损失校验（曼宁公式）
  // H_f = 10.29 × n² × L × Q_pump² / D^5.33
  // 使用压水管管径计算
  const D_actual_m = DN_pumpOut / 1000  // m
  const H_f = 10.29 * Math.pow(n, 2) * L * Math.pow(Q_pump, 2) / Math.pow(D_actual_m, 5.33)

  rows.push(stepRow('沿程损失 H_f', `10.29×n²×L×Q²/D^5.33 =`, fmt(H_f, 3), 'm', '手册第8.3节'))

  // 6.5 局部损失
  const H_local = k_local * H_f
  rows.push(stepRow('局部损失 H_local', `k_local × H_f = ${k_local} × ${fmt(H_f, 3)} =`, fmt(H_local, 3), 'm'))

  // 6.6 总水头损失
  const H_loss = H_f + H_local
  rows.push(stepRow('总水头损失 H_loss', `H_f + H_local =`, fmt(H_loss, 3), 'm'))

  // 6.7 流速校验
  const D_pumpIn_m = DN_pumpIn / 1000
  const v_in_actual = Q_pump / (Math.PI * Math.pow(D_pumpIn_m / 2, 2))
  const v_out_actual = Q_pump / (Math.PI * Math.pow(D_actual_m / 2, 2))

  const v_in_ok = v_in_actual >= 0.6 && v_in_actual <= 1.2
  const v_out_ok = v_out_actual >= 1.0 && v_out_actual <= 1.8

  rows.push(stepRow('泵进水流速 v_in_actual', `Q_pump/(π×(DN/2)²) =`, fmt(v_in_actual, 3), 'm/s'))
  rows.push(stepRow('泵进水流速范围校验', '允许0.6-1.2 m/s', v_in_ok ? '✓ 满足' : '✗ 超出', '', '手册第8.3节'))
  rows.push(stepRow('泵出水流速 v_out_actual', `Q_pump/(π×(DN/2)²) =`, fmt(v_out_actual, 3), 'm/s'))
  rows.push(stepRow('泵出水流速范围校验', '允许1.0-1.8 m/s', v_out_ok ? '✓ 满足' : '✗ 超出', '', '手册第8.3节'))

  if (!v_in_ok) warnings.push(`泵进水流速 ${fmt(v_in_actual)} m/s 超出允许范围 0.6-1.2 m/s`)
  if (!v_out_ok) warnings.push(`泵出水流速 ${fmt(v_out_actual)} m/s 超出允许范围 1.0-1.8 m/s`)

  // 6.8 NPSH 校验
  // NPSH_a = (P_atm - P_v) / (ρg) + H_s - H_suction_loss
  // 简化：NPSH_a = 10.33 - 0.5 + H_s - 0.2
  // H_s 由调用方传入（AG1-2 已计算为固定值2.0m），不再依赖 Z_sump
  const NPSH_a = 10.33 - 0.5 + H_s - 0.2
  const NPSH_ok = NPSH_a >= NPSH_r + 0.5

  rows.push(stepRow('═══════════ NPSH校验 ═══════════', '', '', ''))
  rows.push(stepRow('淹没深度 H_s', '固定值（大型轴流泵典型要求）', fmt(H_s, 2), 'm'))
  rows.push(stepRow('必需汽蚀余量 NPSH_r', '设备参数/工程惯例', NPSH_r, 'm'))
  rows.push(stepRow('有效汽蚀余量 NPSH_a', `10.33-0.5+H_s-0.2 =`, fmt(NPSH_a, 2), 'm', '手册第14.2.3节'))
  rows.push(stepRow('NPSH安全余量', 'NPSH_a ≥ NPSH_r + 0.5', NPSH_ok ? '✓ 满足' : '✗ 不满足', '', '手册第14.2.3节'))

  if (!NPSH_ok) {
    warnings.push(`NPSH校验不通过：NPSH_a(${fmt(NPSH_a)}) < NPSH_r+0.5(${fmt(NPSH_r + 0.5)})`)
  }

  // ── 校验结果汇总 ──────────────────────────────────────────

  rows.push(stepRow('═══════════ 校验结果汇总 ═══════════', '', '', ''))
  rows.push(stepRow('流速校验', `${v_in_ok && v_out_ok ? '✓ 全部通过' : '⚠ 部分超出'}`, '', ''))
  rows.push(stepRow('NPSH校验', `${NPSH_ok ? '✓ 满足' : '⚠ 不满足'}`, '', ''))

  // ── 输出结果 ──────────────────────────────────────────────

  return {
    // 计算状态
    valid: true,
    errors: [],
    warnings,
    // 管道尺寸
    DN_pumpIn,
    DN_pumpOut,
    DN_mainOutlet,
    // 水力参数
    H_f,
    H_local,
    H_loss,
    // 流速
    v_in_actual,
    v_out_actual,
    v_in_ok,
    v_out_ok,
    // NPSH
    NPSH_r,
    NPSH_a,
    NPSH_ok,
    // 设计参数（带依据标注）
    designParams: {
      v_in:      { value: v_in,      unit: 'm/s',      ref: '手册第8.3节' },
      v_out:     { value: v_out,     unit: 'm/s',      ref: '经济流速' },
      n:         { value: n,         unit: 's/m^(1/3)', ref: '手册第8.3节' },
      k_local:   { value: k_local,   unit: '',         ref: '工程惯例' },
      NPSH_r:    { value: NPSH_r,    unit: 'm',        ref: '工程惯例' },
      L:         { value: L,         unit: 'm',         ref: '工程惯例' },
    },
    // 输出给下游
    rows,
  }
}
