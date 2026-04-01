import { ceilTo01, fmt, stepRow } from '../utils.js'

export function runAG21(Q_single, N, S) {
  const Z           = 6
  const V_min       = Q_single / (4 * Z)
  const h_active    = V_min / S
  const h_sub       = 0.5
  const h_reserve   = 0.3
  const h_freeboard = 0.3
  const h_pool_raw  = h_sub + h_active + h_reserve + h_freeboard
  const h_pool      = ceilTo01(h_pool_raw)

  const stopLevel   = h_sub
  const startLevel  = stopLevel + h_active
  const alarmLevel  = startLevel + h_freeboard

  const startLevels = []
  for (let i = 0; i < N; i++) startLevels.push(+(startLevel + i * 0.2).toFixed(2))

  const rows = [
    stepRow('每小时最大启动次数 Z', '取保守值（R-CM-02，Motor.maxStartsPerHour）', Z, '次/h'),
    stepRow('最小有效容积 V_min', `Q_single/(4×Z) = ${fmt(Q_single)}/(4×${Z}) =`, fmt(V_min, 2), 'm³'),
    stepRow('有效调节水深 h_active', `V_min / S = ${fmt(V_min, 2)} / ${fmt(S, 1)} =`, fmt(h_active, 2), 'm'),
    stepRow('淹没保护深度 h_sub', '停泵防吸气（R-CM-03）', fmt(h_sub, 1), 'm'),
    stepRow('底部沉淀区 h_reserve', '池底坡度 ≥ 1:10（R-CM-05）', fmt(h_reserve, 1), 'm'),
    stepRow('超高 h_freeboard', '报警水位余量', fmt(h_freeboard, 1), 'm'),
    stepRow('集水池有效深度 h_pool', `${fmt(h_sub, 1)}+${fmt(h_active, 2)}+${fmt(h_reserve, 1)}+${fmt(h_freeboard, 1)} = ${fmt(h_pool_raw, 2)} → 取整`, fmt(h_pool, 1), 'm'),
    stepRow('停泵水位 stopLevel', '距池底', fmt(stopLevel, 2), 'm'),
    stepRow('首泵启泵水位 startLevel', `stopLevel + h_active = ${fmt(stopLevel, 2)}+${fmt(h_active, 2)} =`, fmt(startLevel, 2), 'm'),
    stepRow('报警水位 alarmLevel', `startLevel + h_freeboard = ${fmt(startLevel, 2)}+${fmt(h_freeboard, 1)} =`, fmt(alarmLevel, 2), 'm'),
  ]

  return {
    Z, V_min, h_active, h_sub, h_reserve, h_freeboard,
    h_pool, stopLevel, startLevel, alarmLevel, startLevels, rows,
  }
}
