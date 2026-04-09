import { ceilTo01, fmt, stepRow } from '../utils.js'

export function runAG21(N, motorPower, N_spare = 0) {
  const w_pump    = 0.6
  const d_pump    = 0.8
  const d_spacing = motorPower > 55 ? 1.2 : 1.0
  const e_wall    = motorPower > 55 ? 1.0 : 0.8
  const N_total   = N + N_spare
  const L_raw     = N_total * w_pump + (N_total - 1) * d_spacing + 2 * e_wall
  const L         = ceilTo01(L_raw)
  const W_equip   = d_pump + 0.5
  const W_raw     = Math.max(1.2, W_equip) + 0.3
  const W         = Math.max(2.5, ceilTo01(W_raw))

  const rows = [
    stepRow('单泵外形宽度 w_pump', '中小型离心泵典型值', fmt(w_pump, 1), 'm'),
    stepRow('单泵外形深度 d_pump', '含电机联轴器典型值', fmt(d_pump, 1), 'm'),
    stepRow('泵间净距 d_spacing', motorPower > 55 ? 'R-LA-01/03（大型泵）' : 'R-LA-01（一般水泵）', fmt(d_spacing, 1), 'm'),
    stepRow('端部距墙净距 e_wall', motorPower > 55 ? 'R-LA-02/03（大型泵）' : 'R-LA-02（一般水泵）', fmt(e_wall, 1), 'm'),
    stepRow('总布置台数（含备用泵）', `工作泵 ${N} 台 + 备用泵 ${N_spare} 台 =`, `${N_total} 台`, ''),
    stepRow('维护间净长 L', `N_total×w + (N_total-1)×d + 2×e = ${N_total}×${w_pump}+${N_total - 1}×${d_spacing}+2×${e_wall} =`, `${fmt(L_raw, 2)} → ${fmt(L, 1)}`, 'm'),
    stepRow('通道净宽 W_equip', `d_pump + 0.5 = ${d_pump} + 0.5 =`, fmt(W_equip, 1), 'm'),
    stepRow('维护间净宽 W', `max(1.2, ${fmt(W_equip, 1)})+0.3，取≥2.5m =`, fmt(W, 1), 'm'),
  ]

  return { w_pump, d_pump, d_spacing, e_wall, L, W, N_total, rows }
}
