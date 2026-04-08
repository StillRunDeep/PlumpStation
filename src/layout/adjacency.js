import { adjacent } from './placer.js'

/**
 * Adjacency graph for the pump station building.
 * MUST pairs: violations reduce feasibility score (−50 each)
 * SHOULD pairs: satisfaction adds bonus points (+15 each)
 */
export const ADJACENCY_MUST = [
  { pair: ['meter_main', 'meter_sub'],  reason: '水表房并排，共用外墙区段' },
  { pair: ['meter_sub',  'fire_equip'], reason: '小型服务房聚集，减少外墙开口分散' },
  { pair: ['fan_room',   'dock2'],      reason: '设备经吊装口直接进出风机房' },
  { pair: ['clean_pump', 'rainwater'],  reason: '共用管道竖井，设备关联度高' },
]

export const ADJACENCY_SHOULD = [
  { pair: ['trafo1',     'trafo2'],      reason: '并排方便母线桥架连接' },
  { pair: ['lv_control', 'corridor_l1'], reason: '控制室通过内走廊进入' },
  { pair: ['clean_pump', 'corridor_l1'], reason: '清洁泵房经走廊联系' },
  { pair: ['rainwater',  'corridor_l1'], reason: '雨水房经走廊联系' },
]

/**
 * Check all adjacency pairs against actual placements.
 * @param {object} placements  Combined ground + level1 placement map
 * @returns {{ satisfied: Array, violated: Array }}
 */
export function checkAdjacency(placements) {
  const satisfied = []
  const violated  = []

  for (const entry of ADJACENCY_MUST) {
    const [a, b] = entry.pair
    if (!placements[a] || !placements[b]) continue
    ;(adjacent(placements[a], placements[b]) ? satisfied : violated)
      .push({ ...entry, type: 'must' })
  }

  for (const entry of ADJACENCY_SHOULD) {
    const [a, b] = entry.pair
    if (!placements[a] || !placements[b]) continue
    ;(adjacent(placements[a], placements[b]) ? satisfied : violated)
      .push({ ...entry, type: 'should' })
  }

  return { satisfied, violated }
}
