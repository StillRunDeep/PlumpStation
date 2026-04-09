import { selectDN, fmt, stepRow } from '../utils.js'

/**
 * AG1-2：水泵选型计算
 *
 * 依据：香港渠务署《雨水排水手册（第五版）》第14章
 *
 * 步骤4：水泵选型
 *   Q_pump = Q_single / 3600  (m³/s)
 *   H_static = Z_discharge - Z_stop
 *   H_f = 10.29 × n² × L × Q_pump² / D^5.33
 *   P_shaft = ρ × g × Q_pump × H_total / (η_hyd × η_mot)
 *   P_motor = P_shaft × K
 *
 * ── 参数说明 ──────────────────────────────────────────────────────────────
 * 输入参数（来自AG0-0或AG1-1）：
 *   Q_single      单泵设计流量（m³/h）
 *   Z_stop        停泵水位（mPD），来自AG1-1
 *   Z_discharge   排放口标高（mPD），用户输入
 *
 * 设计参数（带默认值，依据手册或工程惯例）：
 *   L             出水管长度（m），默认值50，AG0-0用户输入
 *   n             曼宁粗糙系数，默认0.013（混凝土管），手册第8.3节
 *   η_hyd         水力效率，默认0.82（≥0.82），手册第14.6节
 *   η_mot         电机效率，默认0.93（≥0.93），手册第14.6节
 *   NPSH_r        必需汽蚀余量（m），默认3.0，工程惯例
 *   v_in          进水管设计流速（m/s），默认1.0，防止汽蚀
 *   v_out         出水管设计流速（m/s），默认1.5，经济流速
 *   k_local       局部损失系数，默认0.15，沿程损失的15%
 * ─────────────────────────────────────────────────────────────────────────
 */

// 参数范围定义
export const PUMP_SPEC_LIMITS = {
  // 输入参数范围
  Q_single:    { min: 0.1,   max: 10000,  unit: 'm³/h', label: '单泵设计流量' },
  Z_stop:       { min: -50,  max: 10,    unit: 'mPD',  label: '停泵水位' },
  Z_discharge:  { min: -10,  max: 50,    unit: 'mPD',  label: '排放口标高' },
  // 设计参数范围
  L:            { min: 5,    max: 500,   unit: 'm',    label: '出水管长度', ref: '工程惯例' },
  n:            { min: 0.010, max: 0.020, unit: 's/m^(1/3)', label: '曼宁粗糙系数', ref: '手册第8.3节' },
  η_hyd:        { min: 0.70, max: 0.95,  unit: '',     label: '水力效率', ref: '手册第14.6节≥0.82' },
  η_mot:        { min: 0.85, max: 0.98,  unit: '',     label: '电机效率', ref: '手册第14.6节≥0.93' },
  NPSH_r:       { min: 1.0,  max: 8.0,   unit: 'm',    label: '必需汽蚀余量', ref: '工程惯例2-5m' },
  v_in:         { min: 0.6,  max: 1.5,   unit: 'm/s',  label: '进水管设计流速', ref: '手册第8.3节' },
  v_out:        { min: 1.0,  max: 2.5,   unit: 'm/s',  label: '出水管设计流速', ref: '工程惯例' },
  k_local:      { min: 0.05, max: 0.30,  unit: '',     label: '局部损失系数', ref: '工程惯例' },
}

/**
 * 校验AG1-2参数是否在有效范围内
 * @returns {Array} 错误信息数组
 */
export function validatePumpSpecParams(params) {
  const errors = []
  const { Q_single, Z_stop, Z_discharge, L, n, η_hyd, η_mot, NPSH_r, v_in, v_out, k_local } = params

  if (Q_single !== undefined && (Q_single < PUMP_SPEC_LIMITS.Q_single.min || Q_single > PUMP_SPEC_LIMITS.Q_single.max))
    errors.push(`单泵流量 Q_single 应在 ${PUMP_SPEC_LIMITS.Q_single.min}-${PUMP_SPEC_LIMITS.Q_single.max} ${PUMP_SPEC_LIMITS.Q_single.unit} 范围内`)

  if (Z_stop !== undefined && (Z_stop < PUMP_SPEC_LIMITS.Z_stop.min || Z_stop > PUMP_SPEC_LIMITS.Z_stop.max))
    errors.push(`停泵水位 Z_stop 应在 ${PUMP_SPEC_LIMITS.Z_stop.min}-${PUMP_SPEC_LIMITS.Z_stop.max} ${PUMP_SPEC_LIMITS.Z_stop.unit} 范围内`)

  if (Z_discharge !== undefined && (Z_discharge < PUMP_SPEC_LIMITS.Z_discharge.min || Z_discharge > PUMP_SPEC_LIMITS.Z_discharge.max))
    errors.push(`排放口标高 Z_discharge 应在 ${PUMP_SPEC_LIMITS.Z_discharge.min}-${PUMP_SPEC_LIMITS.Z_discharge.max} ${PUMP_SPEC_LIMITS.Z_discharge.unit} 范围内`)

  if (L !== undefined && (L < PUMP_SPEC_LIMITS.L.min || L > PUMP_SPEC_LIMITS.L.max))
    errors.push(`出水管长度 L 应在 ${PUMP_SPEC_LIMITS.L.min}-${PUMP_SPEC_LIMITS.L.max} ${PUMP_SPEC_LIMITS.L.unit} 范围内（${PUMP_SPEC_LIMITS.L.ref}）`)

  if (n !== undefined && (n < PUMP_SPEC_LIMITS.n.min || n > PUMP_SPEC_LIMITS.n.max))
    errors.push(`曼宁粗糙系数 n 应在 ${PUMP_SPEC_LIMITS.n.min}-${PUMP_SPEC_LIMITS.n.max} 范围内（${PUMP_SPEC_LIMITS.n.ref}）`)

  if (η_hyd !== undefined && (η_hyd < PUMP_SPEC_LIMITS.η_hyd.min || η_hyd > PUMP_SPEC_LIMITS.η_hyd.max))
    errors.push(`水力效率 η_hyd 应在 ${PUMP_SPEC_LIMITS.η_hyd.min}-${PUMP_SPEC_LIMITS.η_hyd.max} 范围内（${PUMP_SPEC_LIMITS.η_hyd.ref}）`)

  if (η_mot !== undefined && (η_mot < PUMP_SPEC_LIMITS.η_mot.min || η_mot > PUMP_SPEC_LIMITS.η_mot.max))
    errors.push(`电机效率 η_mot 应在 ${PUMP_SPEC_LIMITS.η_mot.min}-${PUMP_SPEC_LIMITS.η_mot.max} 范围内（${PUMP_SPEC_LIMITS.η_mot.ref}）`)

  if (NPSH_r !== undefined && (NPSH_r < PUMP_SPEC_LIMITS.NPSH_r.min || NPSH_r > PUMP_SPEC_LIMITS.NPSH_r.max))
    errors.push(`必需汽蚀余量 NPSH_r 应在 ${PUMP_SPEC_LIMITS.NPSH_r.min}-${PUMP_SPEC_LIMITS.NPSH_r.max} ${PUMP_SPEC_LIMITS.NPSH_r.unit} 范围内（${PUMP_SPEC_LIMITS.NPSH_r.ref}）`)

  if (v_in !== undefined && (v_in < PUMP_SPEC_LIMITS.v_in.min || v_in > PUMP_SPEC_LIMITS.v_in.max))
    errors.push(`进水管设计流速 v_in 应在 ${PUMP_SPEC_LIMITS.v_in.min}-${PUMP_SPEC_LIMITS.v_in.max} ${PUMP_SPEC_LIMITS.v_in.unit} 范围内（${PUMP_SPEC_LIMITS.v_in.ref}）`)

  if (v_out !== undefined && (v_out < PUMP_SPEC_LIMITS.v_out.min || v_out > PUMP_SPEC_LIMITS.v_out.max))
    errors.push(`出水管设计流速 v_out 应在 ${PUMP_SPEC_LIMITS.v_out.min}-${PUMP_SPEC_LIMITS.v_out.max} ${PUMP_SPEC_LIMITS.v_out.unit} 范围内（${PUMP_SPEC_LIMITS.v_out.ref}）`)

  if (k_local !== undefined && (k_local < PUMP_SPEC_LIMITS.k_local.min || k_local > PUMP_SPEC_LIMITS.k_local.max))
    errors.push(`局部损失系数 k_local 应在 ${PUMP_SPEC_LIMITS.k_local.min}-${PUMP_SPEC_LIMITS.k_local.max} 范围内（${PUMP_SPEC_LIMITS.k_local.ref}）`)

  return errors
}

export function runPumpSpec({
  Q_single,      // 单泵设计流量（m³/h）
  Z_stop,         // 停泵水位（mPD）
  Z_discharge,   // 排放口标高（mPD）
  L = 50,        // 出水管长度（m），默认值依据工程惯例
  n = 0.013,     // 曼宁粗糙系数（混凝土管），默认值依据手册第8.3节
  η_hyd = 0.82,  // 水力效率，默认值依据手册第14.6节≥0.82
  η_mot = 0.93,  // 电机效率，默认值依据手册第14.6节≥0.93
  NPSH_r = 3.0,  // 必需汽蚀余量（m），默认值依据工程惯例
  v_in = 1.0,    // 进水管设计流速（m/s），默认值依据手册第8.3节防止汽蚀
  v_out = 1.5,   // 出水管设计流速（m/s），默认值依据经济流速
  k_local = 0.15, // 局部损失系数，默认值依据工程惯例
}, overrideMotor = null) {
  const rows = []
  const warnings = []

  // ── 参数校验 ──────────────────────────────────────────────
  const validationErrors = validatePumpSpecParams({
    Q_single, Z_stop, Z_discharge, L, n, η_hyd, η_mot, NPSH_r, v_in, v_out, k_local
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
  rows.push(stepRow('出水管长度 L', '工程惯例默认值', L, 'm'))
  rows.push(stepRow('曼宁粗糙系数 n', '手册第8.3节(混凝土管)', n, 's/m^(1/3)'))
  rows.push(stepRow('水力效率 η_hyd', '手册第14.6节要求≥0.82', η_hyd, ''))
  rows.push(stepRow('电机效率 η_mot', '手册第14.6节要求≥0.93', η_mot, ''))
  rows.push(stepRow('必需汽蚀余量 NPSH_r', '工程惯例典型值', NPSH_r, 'm'))
  rows.push(stepRow('进水管设计流速 v_in', '手册第8.3节(防汽蚀)', v_in, 'm/s'))
  rows.push(stepRow('出水管设计流速 v_out', '经济流速', v_out, 'm/s'))
  rows.push(stepRow('局部损失系数 k_local', '工程惯例默认值', k_local, ''))

  // ── 步骤4：水泵选型计算 ───────────────────────────────────

  // 4.1 单泵设计流量
  const Q_pump = Q_single / 3600  // m³/s

  rows.push(stepRow('═══════════ 步骤4：水泵选型 ═══════════', '', '', ''))
  rows.push(stepRow('单泵设计流量 Q_pump', `Q_single / 3600 = ${fmt(Q_single)} / 3600 =`, fmt(Q_pump, 4), 'm³/s'))

  // 4.2 静扬程计算
  const H_static = Z_discharge - Z_stop

  rows.push(stepRow('静扬程 H_static', `Z_discharge - Z_stop = ${fmt(Z_discharge)} - ${fmt(Z_stop)} =`, fmt(H_static, 2), 'm'))

  // 4.3 管道尺寸初估
  const D_out_m = Math.sqrt(4 * Q_pump / (Math.PI * v_out))  // m
  const D_out_mm = D_out_m * 1000

  rows.push(stepRow('出水管计算内径 D_out', `√(4×Q_pump/π×v_out) =`, fmt(D_out_mm, 1), 'mm'))

  // 4.4 沿程损失（曼宁公式）
  // H_f = 10.29 × n² × L × Q_pump² / D^5.33
  const D_actual = selectDN(D_out_mm) / 1000  // m（标准管径）
  const H_f = 10.29 * Math.pow(n, 2) * L * Math.pow(Q_pump, 2) / Math.pow(D_actual, 5.33)

  rows.push(stepRow('标准管径 DN_outlet', '向上取标准系列', `DN${selectDN(D_out_mm)}`, 'mm'))
  rows.push(stepRow('沿程损失 H_f', `10.29×n²×L×Q²/D^5.33 =`, fmt(H_f, 3), 'm', '手册第8.3节'))

  // 4.5 局部损失
  const H_local = k_local * H_f
  const H_loss = H_f + H_local

  rows.push(stepRow('局部损失 H_local', `k_local × H_f = ${k_local} × ${fmt(H_f, 3)} =`, fmt(H_local, 3), 'm'))
  rows.push(stepRow('总水头损失 H_loss', `H_f + H_local =`, fmt(H_loss, 3), 'm'))

  // ── 总扬程 ────────────────────────────────────────────────

  const H_total = H_static + H_loss

  rows.push(stepRow('系统总扬程 H_total', `H_static + H_loss = ${fmt(H_static)} + ${fmt(H_loss)} =`, fmt(H_total, 2), 'm', '手册第14.6.2节'))

  // ── 轴功率（手册公式）─────────────────────────────────────

  // P_shaft = ρ × g × Q_pump × H_total / (η_hyd × η_mot)
  // ρ = 1000 kg/m³, g = 9.81 m/s²
  const ρ = 1000
  const g = 9.81
  const η_combined = η_hyd * η_mot

  const P_shaft = (ρ * g * Q_pump * H_total) / (η_hyd * η_mot) / 1000  // kW

  rows.push(stepRow('═══════════ 轴功率计算 ═══════════', '', '', ''))
  rows.push(stepRow('水密度 ρ', '常数', ρ, 'kg/m³'))
  rows.push(stepRow('重力加速度 g', '常数', g, 'm/s²'))
  rows.push(stepRow('综合效率 η_combined', `η_hyd × η_mot = ${η_hyd} × ${η_mot} =`, fmt(η_combined, 3), ''))
  rows.push(stepRow('轴功率 P_shaft', `ρ×g×Q×H / (η_hyd×η_mot) =`, fmt(P_shaft, 2), 'kW', '手册第14.6.2节'))

  // ── 电机安全系数 ──────────────────────────────────────────

  let K
  if (P_shaft < 15) {
    K = 1.25
  } else if (P_shaft < 55) {
    K = 1.15
  } else {
    K = 1.10
  }

  const P_motor = overrideMotor || P_shaft * K

  rows.push(stepRow('═══════════ 电机功率 ═══════════', '', '', ''))
  rows.push(stepRow('电机安全系数 K', P_shaft < 15 ? 'P<15kW→1.25' : P_shaft < 55 ? '15≤P<55kW→1.15' : 'P≥55kW→1.10', K, '', '手册第14.6.2节'))
  rows.push(stepRow('电机功率 P_motor', overrideMotor ? `覆盖值 = ${overrideMotor}` : `P_shaft × K = ${fmt(P_shaft)} × ${K} =`, fmt(P_motor, 2), 'kW'))

  // ── 效率验证 ──────────────────────────────────────────────
  rows.push(stepRow('═══════════ 效率验证 ═══════════', '', '', ''))
  const η_hyd_ok = η_hyd >= 0.82
  const η_mot_ok = η_mot >= 0.93
  const η_combined_ok = η_combined >= 0.76

  rows.push(stepRow('水力效率验证', `η_hyd = ${η_hyd} ≥ 0.82`, η_hyd_ok ? '✓ 满足' : '✗ 不满足', '', '手册第14.6节'))
  rows.push(stepRow('电机效率验证', `η_mot = ${η_mot} ≥ 0.93`, η_mot_ok ? '✓ 满足' : '✗ 不满足', '', '手册第14.6节'))
  rows.push(stepRow('综合效率验证', `η_combined = ${fmt(η_combined)} ≥ 0.76`, η_combined_ok ? '✓ 满足' : '✗ 不满足', '', '手册第14.6节'))

  // ── 管道尺寸 ──────────────────────────────────────────────

  const D_in_mm = Math.sqrt(4 * Q_pump / (Math.PI * v_in)) * 1000
  const DN_inlet = selectDN(D_in_mm)
  const DN_outlet = selectDN(D_out_mm)

  rows.push(stepRow('═══════════ 管道尺寸 ═══════════', '', '', ''))
  rows.push(stepRow('进水管公称内径 DN_inlet', '向上取标准系列', `DN${DN_inlet}`, 'mm'))
  rows.push(stepRow('出水管公称内径 DN_outlet', '向上取标准系列', `DN${DN_outlet}`, 'mm'))

  // ── 流速校验 ──────────────────────────────────────────────

  const v_in_actual = Q_pump / (Math.PI * Math.pow(DN_inlet / 1000 / 2, 2))
  const v_out_actual = Q_pump / (Math.PI * Math.pow(DN_outlet / 1000 / 2, 2))
  const v_in_ok = v_in_actual >= 0.6 && v_in_actual <= 1.2
  const v_out_ok = v_out_actual >= 1.0 && v_out_actual <= 1.8

  rows.push(stepRow('═══════════ 流速校验 ═══════════', '', '', ''))
  rows.push(stepRow('进水流速 v_in_actual', `Q_pump/(π×(DN/2)²) =`, fmt(v_in_actual, 3), 'm/s', '手册第8.3节'))
  rows.push(stepRow('进水流速范围', '允许0.6-1.2 m/s', v_in_ok ? '✓ 满足' : '✗ 超出', ''))
  rows.push(stepRow('出水流速 v_out_actual', `Q_pump/(π×(DN/2)²) =`, fmt(v_out_actual, 3), 'm/s', '手册第8.3节'))
  rows.push(stepRow('出水流速范围', '允许1.0-1.8 m/s', v_out_ok ? '✓ 满足' : '✗ 超出', ''))

  if (!v_in_ok) warnings.push(`进水流速 ${fmt(v_in_actual)} m/s 超出允许范围 0.6-1.2 m/s`)
  if (!v_out_ok) warnings.push(`出水流速 ${fmt(v_out_actual)} m/s 超出允许范围 1.0-1.8 m/s`)

  // ── NPSH 校验 ─────────────────────────────────────────────

  const H_s = 2.0  // 典型淹没深度（m），大型轴流泵通常需要≥2m
  const NPSH_a = 10.33 - 0.5 + H_s - 0.2  // 简化计算
  const NPSH_ok = NPSH_a >= NPSH_r + 0.5

  rows.push(stepRow('═══════════ NPSH校验 ═══════════', '', '', ''))
  rows.push(stepRow('必需汽蚀余量 NPSH_r', '设备参数/工程惯例', NPSH_r, 'm'))
  rows.push(stepRow('有效汽蚀余量 NPSH_a', `10.33-0.5+H_s-0.2 =`, fmt(NPSH_a, 2), 'm', '手册第14.2.3节'))
  rows.push(stepRow('NPSH安全余量要求', 'NPSH_a ≥ NPSH_r + 0.5', NPSH_ok ? '✓ 满足' : '✗ 不满足', ''))

  if (!NPSH_ok) warnings.push(`NPSH校验不通过：NPSH_a(${fmt(NPSH_a)}) < NPSH_r+0.5(${fmt(NPSH_r+0.5)})`)

  // ── 输出结果 ──────────────────────────────────────────────

  return {
    // 计算状态
    valid: true,
    errors: [],
    warnings,
    // 流量参数
    Q_pump, v_in, DN_inlet, v_out, DN_outlet,
    // 扬程参数
    H_static, H_f, H_local, H_loss, H_total,
    // 功率参数
    η_hyd, η_mot, η_combined, P_shaft, K, P_motor,
    // 校验
    v_in_actual, v_out_actual, v_in_ok, v_out_ok,
    NPSH_r, NPSH_a, NPSH_ok, H_s,
    // 设计参数（带依据标注）
    designParams: {
      L:           { value: L,           unit: 'm',     ref: '工程惯例' },
      n:           { value: n,           unit: 's/m^(1/3)', ref: '手册第8.3节' },
      η_hyd:       { value: η_hyd,       unit: '',      ref: '手册第14.6节≥0.82' },
      η_mot:       { value: η_mot,       unit: '',      ref: '手册第14.6节≥0.93' },
      NPSH_r:      { value: NPSH_r,      unit: 'm',     ref: '工程惯例' },
      v_in:        { value: v_in,        unit: 'm/s',   ref: '手册第8.3节' },
      v_out:       { value: v_out,       unit: 'm/s',   ref: '经济流速' },
      k_local:     { value: k_local,     unit: '',      ref: '工程惯例' },
    },
    // 输出给下游
    rows,
  }
}
