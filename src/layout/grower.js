/**
 * Constraint-growth generator for Template A variants.
 *
 * Template A: 维修区居中 (repair/parking zone in the centre)
 * Building fixed at 18600 × 24000 mm.
 *
 * Per-seed random decisions (Step 2 of AG4-1-1 algorithm):
 *   1. Trafo block side: east (x=10000) or west (x=0)
 *   2. Service room left-right order (3! permutations of meter_main/sub/fire_equip)
 *   3. lv_control width: 7500~9000 mm (snapped to 100)
 *   4. clean_pump / rainwater y split: 17500~18300 mm (snapped to 100)
 *   5. dock1 x-offset within crane zone, dock2 x-offset within fan_room
 *
 * Room coordinates are solved analytically from these decisions — no
 * iterative grid expansion is needed because zone boundaries are fixed
 * by the crane constraints.
 *
 * Coordinates: (0,0) = NW interior corner, X→east, Y→south, units mm.
 */

import { checkAdjacency } from './adjacency.js'
import { CONSTRAINT_CHECKS } from './placer.js'
import { ROOM_DEFS } from './room-defs.js'

// ── Fixed Template-A geometry ─────────────────────────────────────────
const BW           = 18600   // building width
const BD           = 24000   // building depth
const CRANE_ZONE_W = 10000   // 15t crane zone fixed width
const TRAFO_W      = 8600    // transformer block width
const TRAFO1_D     = 8000    // trafo1 depth
const TRAFO2_D     = 8000    // trafo2 depth
const SERVICE_BELT = 3400    // y where crane zone begins (service rooms above)
const FAN_ROOM_W   = 13600   // 5t crane zone width
const FAN_ROOM_D   = 11800   // 5t crane zone depth
const CORRIDOR_W   = 1600    // corridor min clear width
const DOCK_W       = 3000    // dock hatch size (square)

// Service rooms: placed left→right along north wall
const SVC = [
  { id: 'meter_main', w: 2800, d: 3400 },
  { id: 'meter_sub',  w: 2800, d: 3300 },
  { id: 'fire_equip', w: 2800, d: 2500 },
]

// ── Seeded RNG (xorshift32) ───────────────────────────────────────────
function makeRng(seed) {
  // mix seed so sequential integers produce very different streams
  let s = ((seed * 0x6b37d369) ^ 0xdeadbeef) >>> 0
  if (s === 0) s = 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0x100000000
  }
}

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function snap(v, grid = 100) {
  return Math.round(v / grid) * grid
}

// ── Single variant generator ──────────────────────────────────────────

/**
 * Generate one Template A variant deterministically from a seed.
 * @param   {number} seed  0-based index (0..9)
 * @returns {object}  Template object (same shape as TEMPLATE_A1/A2 in templates.js)
 */
export function generateTemplateA(seed) {
  const rng = makeRng(seed)

  // ── Step 2: random decisions ────────────────────────────────────
  const trafoEast  = rng() < 0.5
  const svcOrder   = shuffle(SVC, rng)
  const lvW        = snap(7500 + rng() * 1500)        // 7500..9000 mm
  const cpSplitY   = snap(17500 + rng() * 800)        // 17500..18300 mm
  const dock1XOff  = snap(rng() * (CRANE_ZONE_W - DOCK_W - 200))  // clearance from crane edge
  const dock2XOff  = snap(rng() * (FAN_ROOM_W - DOCK_W - 4000))   // x spread within fan_room

  // ── Derived zone origins ────────────────────────────────────────
  // 15t crane zone (ground floor, centre)
  const craneX = trafoEast ? 0          : TRAFO_W
  // transformer block (ground floor, side)
  const trafoX = trafoEast ? CRANE_ZONE_W : 0
  // service room row starts at same x as crane zone (north wall, non-trafo side)
  const svcX0  = craneX

  // ── Ground floor ────────────────────────────────────────────────
  const svcPlacements = {}
  let sx = svcX0
  for (const r of svcOrder) {
    svcPlacements[r.id] = { x: sx, y: 0, w: r.w, d: r.d }
    sx += r.w
  }

  const ground = {
    trafo1:      { x: trafoX, y: 0,           w: TRAFO_W,      d: TRAFO1_D },
    trafo2:      { x: trafoX, y: TRAFO1_D,    w: TRAFO_W,      d: TRAFO2_D },
    ...svcPlacements,
    // parking and repair_zone share the full crane zone (crane covers both)
    parking:     { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: BD - SERVICE_BELT },
    repair_zone: { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: BD - SERVICE_BELT },
    dock1:       { x: craneX + dock1XOff, y: SERVICE_BELT, w: DOCK_W, d: DOCK_W },
  }

  // ── Level 1 ─────────────────────────────────────────────────────
  // fan_room covers the 5t crane zone, mirroring the ground crane zone side
  const fanX = trafoEast ? 0            : BW - FAN_ROOM_W   // 0 or 5000
  // lv_control on the opposite side
  const lvX  = trafoEast ? BW - lvW     : 0

  // Corridor strip separates lv_control from the pump rooms column
  // trafoEast: corridor to the left of lv_control
  // trafoWest: corridor to the right of lv_control
  const corrX = trafoEast
    ? BW - lvW - CORRIDOR_W
    : lvW

  // Pump rooms column (clean_pump + rainwater stacked N→S)
  const pumpX = trafoEast ? 0 : lvW + CORRIDOR_W
  // rainwater width: fills from pumpX to the opposite wall
  //   trafoEast: pumpX=0, extends right to corrX  → corrX = BW - lvW - CORRIDOR_W
  //   trafoWest: pumpX=lvW+CORRIDOR_W, extends right to BW → BW - pumpX = BW - lvW - CORRIDOR_W
  const rwW   = BW - lvW - CORRIDOR_W

  const cpD  = cpSplitY - FAN_ROOM_D   // clean_pump depth
  const rwD  = BD - cpSplitY           // rainwater depth

  // dock2 inside fan_room, near south wall, x offset for variety
  const dock2X = fanX + 2000 + dock2XOff
  const dock2Y = FAN_ROOM_D - DOCK_W - 1000   // 7800 mm from north

  const level1 = {
    fan_room:    { x: fanX,  y: 0,           w: FAN_ROOM_W, d: FAN_ROOM_D },
    dock2:       { x: dock2X, y: dock2Y,     w: DOCK_W,     d: DOCK_W     },
    lv_control:  { x: lvX,   y: 0,           w: lvW,        d: 17500      },
    clean_pump:  { x: pumpX, y: FAN_ROOM_D,  w: 6500,       d: cpD        },
    rainwater:   { x: pumpX, y: cpSplitY,    w: rwW,        d: rwD        },
    corridor_l1: { x: corrX, y: FAN_ROOM_D,  w: CORRIDOR_W, d: BD - FAN_ROOM_D },
  }

  // ── Assemble ─────────────────────────────────────────────────────
  const svcLabels = { meter_main: '总水表', meter_sub: '水表', fire_equip: '消防' }
  const svcDesc   = svcOrder.map(r => svcLabels[r.id]).join('→')
  const sideLabel = trafoEast ? '变压器东置' : '变压器西置'

  return {
    id:    `A${seed + 1}`,
    label: `维修区居中·${sideLabel}`,
    desc:  `约束生长第 ${seed + 1} 次（种子 ${seed}）：${sideLabel}，` +
           `北墙服务用房顺序 ${svcDesc}，` +
           `配电室宽 ${lvW / 1000} m，清洁泵房高 ${(cpSplitY - FAN_ROOM_D) / 1000} m。`,
    ground,
    level1,
    buildingW: BW,
    buildingD: BD,
    crane15: { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: BD - SERVICE_BELT },
    crane5:  { x: fanX,   y: 0,            w: FAN_ROOM_W,   d: FAN_ROOM_D },
  }
}

// ── Constraint evaluator (mirrors evaluateTemplate in placer.js) ──────

function evaluateGrownTemplate(template) {
  const allPlacements = { ...template.ground, ...template.level1 }
  const violations = []

  for (const [id, placement] of Object.entries(allPlacements)) {
    const def = ROOM_DEFS[id]
    if (!def) continue
    for (const key of def.constraints) {
      const checkFn = CONSTRAINT_CHECKS[key]
      if (!checkFn) continue
      if (!checkFn(id, allPlacements, template)) {
        violations.push({ room: id, constraint: key })
      }
    }
  }

  const adjacency = checkAdjacency(allPlacements)
  for (const v of adjacency.violated) {
    if (v.type === 'must') {
      violations.push({ room: v.pair.join('↔'), constraint: 'must_adjacent' })
    }
  }

  return {
    feasible: violations.length === 0,
    placements: allPlacements,
    groundPlacements: template.ground,
    level1Placements: template.level1,
    violations,
    adjacency,
    template,
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate and evaluate 10 Template A variants (seeds 0..9).
 * Returns the same result shape as evaluateTemplate() in placer.js.
 * @returns {Array}  10 evaluated variants
 */
export function generateTemplateAVariants() {
  return Array.from({ length: 10 }, (_, seed) =>
    evaluateGrownTemplate(generateTemplateA(seed))
  )
}
