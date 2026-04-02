import { fmt } from '../utils.js'
import { _r, _l, _t, _poly, _dh, _dv } from '../render/svg-helpers.js'
import { initSvgZoomPan } from '../render/zoom-pan.js'

export function runAG31(N, ag12, ag21, S) {
  const { L, W, d_spacing, e_wall, w_pump, d_pump } = ag12
  const { h_pool, stopLevel, startLevel, alarmLevel } = ag21

  const L_pool = Math.max(L, Math.sqrt(S * 1.5))
  const D_pool = S / L_pool
  const room_H = Math.max(3.0, h_pool * 0.2 + 1.0)

  const VW = 1080, VH = 580
  let s = ''

  s += _r(0, 0, VW, VH, '#f4f6f8', 'none')
  s += _l(572, 15, 572, VH - 15, '#ccc', 1, '5,3')

  // ── Plan view (left) ──
  const PML = 78, PMR = 48, PMT = 55, PMB = 62
  const PW = 572, PH = VH
  const pavw = PW - PML - PMR, pavh = PH - PMT - PMB
  const ps = Math.min(pavw / L_pool, pavh / (W + D_pool))
  const pool_ox = PML + (pavw - L_pool * ps) / 2
  const room_ox = pool_ox + (L_pool - L) / 2 * ps
  const room_oy = PMT + (pavh - (W + D_pool) * ps) / 2
  const room_x2 = room_ox + L * ps
  const room_y2 = room_oy + W * ps
  const pool_x2 = pool_ox + L_pool * ps
  const pool_y2 = room_y2 + D_pool * ps
  const hdr_y   = room_oy + Math.max(14, 0.2 * ps)

  s += _t(PW / 2, PMT - 14, '平 面 图（俯 视）', 13, '#1a5276', 'middle', 'bold')

  s += _r(pool_ox, room_y2, L_pool * ps, D_pool * ps, '#d6eaf8', '#2471a3', 2)
  const pcx = (pool_ox + pool_x2) / 2, pcy = room_y2 + D_pool * ps / 2
  s += _t(pcx, pcy - 8, '集 水 池', 13, '#1a5276', 'middle', 'bold')
  s += _t(pcx, pcy + 8, `S=${fmt(S, 1)}m²  h_pool=${fmt(h_pool, 1)}m（竖向）`, 10, '#1a5276')
  s += _t(pcx, pcy + 21, '水位见右侧剖面图', 9, '#888')
  s += _l(room_ox, room_y2, room_x2, room_y2, '#5d6d7e', 1.5, '4,3')

  s += _r(room_ox, room_oy, L * ps, W * ps, '#eaf2fb', '#2c3e50', 2.5)

  s += _l(room_ox + e_wall * ps, hdr_y, room_x2 - e_wall * ps, hdr_y, '#922b21', 4)
  s += _t(room_ox + e_wall * ps + 3, hdr_y - 6, 'DN' + ag12.DN_label + ' 出水总管', 10, '#922b21', 'start')

  const cb_w = Math.min(45, e_wall * ps * 0.9), cb_h = Math.min(26, 0.3 * ps)
  const cb_x = room_x2 - e_wall * ps / 2 - cb_w / 2, cb_y = hdr_y + 6
  s += _r(cb_x, cb_y, cb_w, cb_h, '#e67e22', '#d35400')
  s += _t(cb_x + cb_w / 2, cb_y + cb_h / 2 + 4, '控制柜', 9, '#fff', 'middle', 'bold')

  for (let i = 0; i < N; i++) {
    const px = room_ox + (e_wall + i * (w_pump + d_spacing)) * ps
    const py = room_y2 - d_pump * ps
    const pw = w_pump * ps, ph = d_pump * ps
    const cx = px + pw / 2
    s += _l(cx, room_y2, cx, pool_y2 - 6, '#2980b9', 1.5, '4,3')
    s += _l(cx, py, cx, hdr_y, '#c0392b', 1.5)
    const cv_y = py - (py - hdr_y) * 0.35, vs = 5
    s += _poly(`${cx},${cv_y - vs} ${cx + vs},${cv_y} ${cx},${cv_y + vs} ${cx - vs},${cv_y}`, '#e74c3c')
    const gv_y = py - (py - hdr_y) * 0.65
    s += _r(cx - 4, gv_y - 4, 8, 8, '#e74c3c', '#c0392b')
    s += _r(px, py, pw, ph, '#2471a3', '#1a5276', 1.5)
    const fsz = Math.max(9, Math.min(12, pw * 0.4))
    s += _t(cx, py + ph / 2 + 4, 'P' + (i + 1), fsz, '#fff', 'middle', 'bold')
  }

  const aa_y = room_y2 - d_pump * ps / 2
  s += _l(4, aa_y, room_ox - 6, aa_y, '#7f8c8d', 1, '6,3')
  s += _l(room_x2 + 6, aa_y, PW - 6, aa_y, '#7f8c8d', 1, '6,3')
  s += _t(5, aa_y - 4, 'A', 11, '#555', 'start', 'bold')
  s += _t(PW - 5, aa_y - 4, 'A', 11, '#555', 'end', 'bold')

  const dim_by = pool_y2 + 28
  s += _dh(room_ox, room_x2, dim_by, 'L=' + fmt(L, 1) + 'm', '#1a3a5c')
  if (Math.abs(L_pool - L) > 0.05)
    s += _dh(pool_ox, pool_x2, dim_by + 22, 'L_pool=' + fmt(L_pool, 1) + 'm', '#2471a3')
  const dim_rx = pool_x2 + 32
  s += _dv(dim_rx, room_oy, room_y2, 'W=' + fmt(W, 1) + 'm', '#1a3a5c')
  s += _dv(dim_rx, room_y2, pool_y2, 'D=' + fmt(D_pool, 2) + 'm', '#2471a3')
  if (N >= 2) {
    const p0x = room_ox + (e_wall + w_pump) * ps, p1x = p0x + d_spacing * ps
    const sp_y = room_y2 - d_pump * ps * 0.5
    s += _dh(p0x, p1x, sp_y, 'd=' + fmt(d_spacing, 1) + 'm', '#27ae60')
  }
  s += _dh(room_ox, room_ox + e_wall * ps, room_oy + 18, 'e=' + fmt(e_wall, 1) + 'm', '#8e44ad')

  const legItems = [['#2471a3', '水泵机组'], ['#d6eaf8', '集水池'], ['#922b21', '出水总管'], ['#2980b9', '进水管'], ['#e74c3c', '止回/闸阀'], ['#e67e22', '控制柜']]
  let lyi = room_oy
  s += _r(4, lyi - 2, 94, legItems.length * 17 + 4, '#fff', '#ccc', 0.5, 'rx="3" opacity="0.9"')
  legItems.forEach(([c, lbl]) => {
    s += _r(7, lyi, 11, 11, c, '#666', 0.5)
    s += _t(21, lyi + 9, lbl, 10, '#333', 'start')
    lyi += 17
  })

  const bar_len = ps, bx = room_ox, by_bar = pool_y2 + 10
  s += _l(bx, by_bar, bx + bar_len, by_bar, '#333', 2)
  s += _l(bx, by_bar - 4, bx, by_bar + 4, '#333', 1.5)
  s += _l(bx + bar_len, by_bar - 4, bx + bar_len, by_bar + 4, '#333', 1.5)
  s += _t(bx + bar_len / 2, by_bar - 6, '1 m', 10, '#333')

  // ── Section view (right) ──
  const SX0 = 580, SW = VW - SX0
  const SML = 65, SMR = 80, SMT = 55, SMB = 55
  const savw = SW - SML - SMR, savh = VH - SMT - SMB
  const ss = Math.min(savw / (W + 1.5), savh / (room_H + h_pool + 0.5))

  const sec_cx = SX0 + SML + savw / 2
  const sec_wx = W * ss
  const sec_x1 = sec_cx - sec_wx / 2, sec_x2 = sec_cx + sec_wx / 2
  const grade_y    = SMT + room_H * ss
  const room_top_y = SMT
  const pool_bot_y = grade_y + h_pool * ss

  const stop_y  = pool_bot_y - stopLevel * ss
  const start_y = pool_bot_y - startLevel * ss
  const alarm_y = pool_bot_y - alarmLevel * ss

  s += _t(SX0 + SW / 2, SMT - 14, 'A-A 剖 面 图（沿 泵 轴）', 13, '#1a5276', 'middle', 'bold')
  s += _r(sec_x1 - 6, grade_y, sec_wx + 12, h_pool * ss + 6, '#eaf2fb', 'none')
  s += _r(sec_x1, alarm_y, sec_wx, pool_bot_y - alarm_y, '#d6eaf8', 'none')
  s += _r(sec_x1, grade_y, sec_wx, h_pool * ss, 'none', '#2471a3', 2)
  s += _r(sec_x1, room_top_y, sec_wx, room_H * ss, '#eaf2fb', '#2c3e50', 2.5)
  s += _l(SX0 + 4, grade_y, SX0 + SW - 4, grade_y, '#2c3e50', 2)
  s += _t(sec_x1 - 5, grade_y + 4, '±0.00', 9, '#555', 'end')
  s += _l(sec_x1, stop_y, sec_x2, stop_y, '#27ae60', 1.5, '5,3')
  s += _l(sec_x1, start_y, sec_x2, start_y, '#e67e22', 1.5, '5,3')
  s += _l(sec_x1, alarm_y, sec_x2, alarm_y, '#c0392b', 1.5, '5,3')

  const wl_lx = sec_x2 + 6
  s += _t(wl_lx, stop_y + 4, '停泵 ' + fmt(stopLevel, 2) + 'm', 10, '#27ae60', 'start')
  s += _t(wl_lx, start_y + 4, '启泵 ' + fmt(startLevel, 2) + 'm', 10, '#e67e22', 'start')
  s += _t(wl_lx, alarm_y - 3, '报警 ' + fmt(alarmLevel, 2) + 'm', 10, '#c0392b', 'start')
  s += _t(wl_lx, pool_bot_y + 4, '池底 0.00m', 10, '#555', 'start')

  const pump_w = Math.min(sec_wx * 0.35, 30), pump_h = Math.min(room_H * ss * 0.25, 28)
  const pump_x = sec_cx - pump_w / 2, pump_y = grade_y - pump_h - 4
  s += _r(pump_x, pump_y, pump_w, pump_h, '#2471a3', '#1a5276', 1.5)
  s += _t(pump_x + pump_w / 2, pump_y + pump_h / 2 + 4, 'P', 10, '#fff', 'middle', 'bold')

  const pcx_s = pump_x + pump_w / 2
  s += _l(pcx_s, pump_y + pump_h, pcx_s, pool_bot_y - 6, '#2980b9', 2)
  s += _poly(`${pcx_s},${pool_bot_y - 6} ${pcx_s - 4},${pool_bot_y - 14} ${pcx_s + 4},${pool_bot_y - 14}`, '#2980b9')

  const out_x = pcx_s + pump_w * 0.35
  s += _l(out_x, pump_y, out_x, room_top_y + 4, '#c0392b', 2)
  s += _poly(`${out_x},${room_top_y + 4} ${out_x - 4},${room_top_y + 12} ${out_x + 4},${room_top_y + 12}`, '#c0392b')

  const sec_dvx = sec_x1 - 32
  s += _dv(sec_dvx, room_top_y, grade_y, '室高 ' + fmt(room_H, 1) + 'm', '#1a3a5c')
  s += _dv(sec_dvx, grade_y, pool_bot_y, 'h_pool=' + fmt(h_pool, 1) + 'm', '#2471a3')
  s += _dh(sec_x1, sec_x2, pool_bot_y + 28, 'W=' + fmt(W, 1) + 'm', '#1a3a5c')

  const el = document.getElementById('svg-ag31')
  el.setAttribute('viewBox', `0 0 ${VW} ${VH}`)
  el.innerHTML = s
  initSvgZoomPan(el, VW, VH, { zIn: 'btn-ag31-zin', zOut: 'btn-ag31-zout', zRst: 'btn-ag31-rst' })
}
