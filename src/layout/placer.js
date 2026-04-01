import { ROOM_DEFS } from './room-defs.js'

// ── Geometry helpers ──────────────────────────────────────────────

export function centerX(p) { return p.x + p.w / 2 }
export function centerY(p) { return p.y + p.d / 2 }

export function contains(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.d <= outer.y + outer.d
  )
}

export function adjacent(a, b, tol = 200) {
  // Rooms share an edge within tolerance (mm)
  const xOverlap = a.x < b.x + b.w && a.x + a.w > b.x
  const yOverlap = a.y < b.y + b.d && a.y + a.d > b.y
  const touchH   = Math.abs(a.x + a.w - b.x) <= tol || Math.abs(b.x + b.w - a.x) <= tol
  const touchV   = Math.abs(a.y + a.d - b.y) <= tol || Math.abs(b.y + b.d - a.y) <= tol
  return (touchH && yOverlap) || (touchV && xOverlap)
}

export function touchesExteriorNonSouth(p, buildingW, buildingD, tol = 100) {
  return (
    p.x <= tol ||                        // west wall
    p.y <= tol ||                        // north wall
    p.x + p.w >= buildingW - tol         // east wall
    // south wall excluded (no doors on south)
  )
}

// ── Constraint checkers ───────────────────────────────────────────

export const CONSTRAINT_CHECKS = {
  ext_access: (id, placements, template) => {
    const p = placements[id]
    if (!p) return false
    return touchesExteriorNonSouth(p, template.buildingW, template.buildingD)
  },

  crane15_cover: (id, placements, template) => {
    const p = placements[id]
    if (!p) return false
    return contains(template.crane15, p)
  },

  crane5_cover: (id, placements, template) => {
    const p = placements[id]
    if (!p) return false
    return contains(template.crane5, p)
  },

  near_dock2: (id, placements) => {
    const fan  = placements[id]
    const dock = placements['dock2']
    if (!fan || !dock) return true  // skip if dock2 not yet placed
    const dist = Math.hypot(centerX(fan) - centerX(dock), centerY(fan) - centerY(dock))
    return dist <= 10000  // 10 m tolerance
  },
}

// ── Main placement validator ──────────────────────────────────────

/**
 * Evaluate a template: check all constraints for all placed rooms.
 * Returns { feasible, placements, violations }.
 */
export function evaluateTemplate(template) {
  const allPlacements = { ...template.ground, ...template.level1 }
  const violations = []

  for (const [id, placement] of Object.entries(allPlacements)) {
    const def = ROOM_DEFS[id]
    if (!def) continue

    for (const key of def.constraints) {
      const checkFn = CONSTRAINT_CHECKS[key]
      if (!checkFn) continue
      const ok = checkFn(id, allPlacements, template)
      if (!ok) violations.push({ room: id, constraint: key })
    }
  }

  return {
    feasible: violations.length === 0,
    placements: allPlacements,
    groundPlacements: template.ground,
    level1Placements: template.level1,
    violations,
    template,
  }
}
