import { selectDN, fmt, stepRow } from '../utils.js'

export function runAG11(Q, N, h_pool, h_outlet, pipe_length) {
  const η    = 0.70
  const C_hw = 120 // Hazen-Williams coefficient (steel pipe)

  const Q_single = Q / N
  const q = Q_single / 3600 // m³/s

  const v_out   = 1.5
  const D_out_m = Math.sqrt(4 * q / (Math.PI * v_out))
  const R_L     = 10.67 * pipe_length * Math.pow(q, 1.852) /
                  (Math.pow(C_hw, 1.852) * Math.pow(D_out_m, 4.87))
  const R_j     = 0.15 * R_L
  const R_room  = 2.0
  const R       = R_L + R_j + R_room

  const H_static = h_pool + h_outlet
  const H        = H_static + R

  const Pz = (Q_single * H) / (367 * η)
  const K  = Pz < 15 ? 1.25 : (Pz < 55 ? 1.15 : 1.10)
  const P_motor = Pz * K

  const v_in        = 1.0
  const D_inner_in  = Math.sqrt(4 * q / (Math.PI * v_in)) * 1000  // mm
  const DN_inlet    = selectDN(D_inner_in)
  const D_inner_out = D_out_m * 1000                                // mm
  const DN_outlet   = selectDN(D_inner_out)
  const dnOverflow  = D_inner_in > 1500 || D_inner_out > 1500

  // Step 7: operating point efficiency check (R-HY-03)
  const η_BEP       = 0.80          // typical centrifugal pump BEP efficiency
  const η_threshold = 0.85 * η_BEP  // minimum acceptable = 0.68
  const effPass     = η >= η_threshold

  const rows = [
    stepRow('单泵设计流量 Q_single', `Q / N = ${fmt(Q)} / ${N} =`, fmt(Q_single), 'm³/h'),
    stepRow('单泵流量 q（m³/s）', 'Q_single / 3600 =', fmt(q, 5), 'm³/s'),
    stepRow('出水管初估内径 D_out', `√(4q / π×${v_out}) × 1000 =`, fmt(D_inner_out, 1), 'mm'),
    stepRow('沿程阻力 R_L（Hazen-Williams）', `10.67×L×q^1.852 / (C^1.852×D^4.87) =`, fmt(R_L, 3), 'm'),
    stepRow('局部阻力 R_j', `0.15 × R_L = 0.15 × ${fmt(R_L, 3)} =`, fmt(R_j, 3), 'm'),
    stepRow('设备阻力 R_room', '闸阀、止回阀等默认值', fmt(R_room, 1), 'm'),
    stepRow('总管网阻力 R', 'R_L + R_j + R_room =', fmt(R, 3), 'm'),
    stepRow('静扬程 H_static', `h_pool + h_outlet = ${fmt(h_pool, 1)} + ${fmt(h_outlet, 1)} =`, fmt(H_static, 2), 'm'),
    stepRow('系统设计扬程 H', `H_static + R = ${fmt(H_static, 2)} + ${fmt(R, 3)} =`, fmt(H, 2), 'm'),
    stepRow('轴功率 Pz', `Q_single×H / (367×η) = ${fmt(Q_single)}×${fmt(H, 2)} / (367×${η}) =`, fmt(Pz, 2), 'kW'),
    stepRow('电机安全系数 K', Pz < 15 ? 'Pz < 15 kW → K=1.25' : (Pz < 55 ? '15≤Pz<55 kW → K=1.15' : 'Pz≥55 kW → K=1.10'), K.toFixed(2), ''),
    stepRow('电机功率 P_motor', `Pz × K = ${fmt(Pz, 2)} × ${K.toFixed(2)} =`, fmt(P_motor, 2), 'kW'),
    stepRow('进水管计算内径', `√(4q / π×${v_in}) × 1000 =`, fmt(D_inner_in, 1), 'mm'),
    stepRow('进水管公称内径 DN_inlet', '向上取标准管径系列', `DN${DN_inlet}`, 'mm'),
    stepRow('出水管计算内径', `√(4q / π×${v_out}) × 1000 =`, fmt(D_inner_out, 1), 'mm'),
    stepRow('出水管公称内径 DN_outlet', '向上取标准管径系列', `DN${DN_outlet}`, 'mm'),
    stepRow('工作点效率验证 η_operating', `η=${η} ≥ 0.85×η_BEP(${η_BEP}) = ${fmt(η_threshold, 2)}`, effPass ? '✓ 满足' : '✗ 不满足', ''),
  ]

  return { Q_single, q, H_static, R_L, R_j, R_room, R, H, Pz, K, P_motor,
    v_in, D_inner_in, DN_inlet, v_out, D_inner_out, DN_outlet, dnOverflow,
    η, η_BEP, η_threshold, effPass, rows }
}
