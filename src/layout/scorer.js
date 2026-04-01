import { adjacent, centerX, centerY } from './placer.js'

/**
 * Score a layout result (higher = better).
 * Criteria:
 *   - Compactness: penalise total footprint area
 *   - Service rooms grouped: bonus if water-meter rooms are adjacent
 *   - Trafo ventilation: bonus if trafo rooms touch two exterior walls
 *   - Fan room access: bonus if fan_room is close to dock2
 */
export function scoreLayout(result) {
  const { template, placements } = result
  let score = 10000

  // 1. Footprint penalty (per m²)
  const areaMm2 = template.buildingW * template.buildingD
  score -= (areaMm2 / 1e6) * 8   // 8 pts per m²

  // 2. Service rooms grouped (water-meter rooms adjacent → +30)
  if (placements.meter_main && placements.meter_sub) {
    if (adjacent(placements.meter_main, placements.meter_sub))
      score += 30
  }

  // 3. Trafo touching east or west exterior wall → +20 each
  const bW = template.buildingW
  const trafos = ['trafo1', 'trafo2']
  trafos.forEach(id => {
    const p = placements[id]
    if (!p) return
    const onWest = p.x <= 100
    const onEast = p.x + p.w >= bW - 100
    if (onWest || onEast) score += 20
  })

  // 4. Both trafos on same side (organised) → +20
  if (placements.trafo1 && placements.trafo2) {
    const t1 = placements.trafo1, t2 = placements.trafo2
    const sameSide = Math.abs(t1.x - t2.x) < 200
    if (sameSide) score += 20
  }

  // 5. Fan room near dock2 → bonus up to +30
  if (placements.fan_room && placements.dock2) {
    const dist = Math.hypot(
      centerX(placements.fan_room) - centerX(placements.dock2),
      centerY(placements.fan_room) - centerY(placements.dock2)
    )
    score += Math.max(0, 30 - dist / 500)  // linear decay with distance
  }

  // 6. Adjacency satisfaction bonus
  const adj = result.adjacency
  if (adj) {
    adj.satisfied.forEach(v => {
      score += v.type === 'must' ? 40 : 15
    })
    // Corridor integration bonus: corridor adjacent to ≥2 target rooms
    const corridorHits = adj.satisfied.filter(v => v.pair.includes('corridor_l1')).length
    if (corridorHits >= 2) score += 20
  }

  // 7. Penalty for constraint violations (includes must_adjacent violations)
  score -= result.violations.length * 50

  return Math.round(score)
}
