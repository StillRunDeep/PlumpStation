/**
 * Constraint-growth generator for Template A variants.
 *
 * Template A: 维修区居中 (repair/parking zone in the centre)
 *
 * Building dimensions are user-parameterised. All zone geometry scales
 * proportionally from the reference building (18600 × 24000 mm).
 *
 * Per-seed random decisions:
 *   1. Trafo block side: east or west
 *   2. Service room left-right order (3! permutations of meter_main/sub/fire_equip)
 *   3. lv_control width: lvWMin..lvWMax (scaled)
 *   4. clean_pump / rainwater Y-split within a valid range (scaled)
 *   5. Parking/repair crane-zone split (default or from user target area)
 *   6. dock1 x-offset within crane zone, dock2 x-offset within fan_room
 *
 * Parking is treated as an independent functional space (separate room from
 * repair_zone), positioned in the lower part of the 15t crane zone.
 *
 * Generates 5 + 6×3 = 23 Template A variants:
 *   • 5 variants at user-specified building dimensions
 *   • 3 variants each at 6 standard aspect ratios (same floor area):
 *     长宽比 1 / 1.2 / 1.5 / 1.8 / 2 / 2.4
 *
 * Coordinates: (0,0) = NW interior corner, X→east, Y→south, units mm.
 */

import { checkAdjacency } from './adjacency.js'
import { CONSTRAINT_CHECKS } from './placer.js'
import { ROOM_DEFS } from './room-defs.js'

// ── Reference building dimensions ────────────────────────────────────
const BASE_BW = 18600
const BASE_BD = 24000

// Proportional ratios derived from the reference building
const R_CRANE_W      = 10000 / BASE_BW   // crane zone width / building width
const R_SERVICE      = 3400  / BASE_BD   // service belt depth / building depth
const R_TRAFO_D      = 8000  / BASE_BD   // single trafo depth / building depth
const R_FAN_W        = 13600 / BASE_BW   // fan room width / building width
const R_FAN_D        = 11800 / BASE_BD   // fan room depth / building depth
const R_LV_W_MIN     = 7500  / BASE_BW   // lv_control min-width ratio
const R_LV_W_MAX     = 9000  / BASE_BW   // lv_control max-width ratio
const R_LV_D         = 17500 / BASE_BD   // lv_control depth ratio
const R_CP_SPLIT_MIN = 17500 / BASE_BD   // clean_pump/rainwater split min ratio
const R_CP_SPLIT_MAX = 18300 / BASE_BD   // clean_pump/rainwater split max ratio
const R_CP_W         = 6500  / BASE_BW   // clean_pump width ratio
const R_PARKING_D    = 17200 / BASE_BD   // default parking depth (from ROOM_DEFS)

// Fixed dimensions (not scaled with building size)
const CORRIDOR_W = 1600   // Level-1 corridor minimum clear width (mm)
const DOCK_W     = 3000   // delivery hatch square size (mm)

// Ground floor service rooms — proportions of reference building
const SVC_PROPS = [
  { id: 'meter_main', wR: 2800 / BASE_BW, dR: 3400 / BASE_BD },
  { id: 'meter_sub',  wR: 2800 / BASE_BW, dR: 3300 / BASE_BD },
  { id: 'fire_equip', wR: 2800 / BASE_BW, dR: 2500 / BASE_BD },
]

// Standard aspect ratios for the 18 alternative-dimension variants (BD/BW)
const ASPECT_RATIOS = [1, 1.2, 1.5, 1.8, 2, 2.4]

// ── Seeded RNG (xorshift32) ───────────────────────────────────────────
function makeRng(seed) {
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
 * Generate one Template A variant for the given building dimensions and
 * optional room-area overrides.
 *
 * @param {number} seed       Integer RNG seed
 * @param {number} bW         Building width (mm), east-west
 * @param {number} bD         Building depth (mm), north-south
 * @param {object} roomAreas  Optional target areas per room ID (m²).
 *                            Recognised keys: parking, repair_zone, lv_control, clean_pump
 * @param {string} groupId    Short group label, e.g. 'S', 'R1.0'
 * @param {number} variantIdx 1-based index within the group
 */
export function generateTemplateA(seed, bW, bD, roomAreas = {}, groupId = 'S', variantIdx = 1) {
  const rng = makeRng(seed)

  // ── Scaled zone dimensions ──────────────────────────────────────
  const CRANE_ZONE_W = snap(bW * R_CRANE_W)
  const TRAFO_W      = bW - CRANE_ZONE_W
  const SERVICE_BELT = snap(bD * R_SERVICE)
  const TRAFO1_D     = snap(bD * R_TRAFO_D)
  const TRAFO2_D     = snap(bD * R_TRAFO_D)
  const FAN_ROOM_W   = snap(bW * R_FAN_W)
  const FAN_ROOM_D   = snap(bD * R_FAN_D)
  const LV_D         = snap(bD * R_LV_D)
  const craneZoneD   = bD - SERVICE_BELT

  // Scaled SVC room dimensions
  const SVC = SVC_PROPS.map(r => ({
    id: r.id,
    w:  snap(bW * r.wR),
    d:  snap(bD * r.dR),
  }))

  // Scaled lv_control width range
  const lvWMin = snap(bW * R_LV_W_MIN)
  const lvWMax = snap(bW * R_LV_W_MAX)

  // Scaled cpSplitY range
  const cpSplitYMin = snap(bD * R_CP_SPLIT_MIN)
  const cpSplitYMax = snap(bD * R_CP_SPLIT_MAX)

  // ── Random decisions ────────────────────────────────────────────
  const trafoEast = rng() < 0.5
  const svcOrder  = shuffle(SVC, rng)

  // Always consume exactly 2 RNG values per continuous parameter so that
  // downstream random decisions are identical regardless of overrides.
  const rv_lv1 = rng(), rv_lv2 = rng()
  const rv_cp1 = rng(), rv_cp2 = rng()
  const rv_pk1 = rng()   // parking jitter

  // lv_control width — user override takes precedence, then random
  let lvW
  if (roomAreas.lv_control > 0) {
    const derived = snap(roomAreas.lv_control * 1e6 / LV_D)
    const jitter  = snap((rv_lv1 - 0.5) * 200)
    lvW = Math.max(lvWMin, Math.min(lvWMax, derived + jitter))
  } else {
    lvW = snap(lvWMin + rv_lv2 * (lvWMax - lvWMin))
  }

  // clean_pump / rainwater Y-split
  let cpSplitY
  if (roomAreas.clean_pump > 0) {
    const cpW_approx = snap(bW * R_CP_W)
    const cpD_target = snap(roomAreas.clean_pump * 1e6 / cpW_approx)
    const derived    = FAN_ROOM_D + cpD_target
    const jitter     = snap((rv_cp1 - 0.5) * 200)
    cpSplitY = Math.max(cpSplitYMin, Math.min(cpSplitYMax, derived + jitter))
  } else {
    cpSplitY = snap(cpSplitYMin + rv_cp2 * (cpSplitYMax - cpSplitYMin))
  }

  // Parking / repair split within crane zone
  // parking goes at the SOUTH end; repair_zone at the NORTH end (near dock entrance)
  let parkingD
  if (roomAreas.parking > 0) {
    parkingD = snap(roomAreas.parking * 1e6 / CRANE_ZONE_W)
    parkingD = Math.max(2000, Math.min(craneZoneD - 2000, parkingD))
  } else if (roomAreas.repair_zone > 0) {
    const repD = snap(roomAreas.repair_zone * 1e6 / CRANE_ZONE_W)
    parkingD   = Math.max(2000, craneZoneD - repD)
  } else {
    // Default: parking gets proportional area from ROOM_DEFS default, with ±10% random jitter
    const defParkingD = snap(bD * R_PARKING_D)
    const jitter      = snap((rv_pk1 - 0.5) * craneZoneD * 0.1)
    parkingD = Math.max(2000, Math.min(craneZoneD - 2000, defParkingD + jitter))
  }
  const repairD = craneZoneD - parkingD

  // dock offsets for variety
  const dock1XOff = snap(rng() * Math.max(0, CRANE_ZONE_W - DOCK_W - 200))
  const dock2XMax = Math.max(0, FAN_ROOM_W - DOCK_W - 4000)
  const dock2XOff = dock2XMax > 0 ? snap(rng() * dock2XMax) : 0

  // ── Zone origins ────────────────────────────────────────────────
  const craneX = trafoEast ? 0          : TRAFO_W
  const trafoX = trafoEast ? CRANE_ZONE_W : 0
  const svcX0  = craneX

  // ── Ground floor ────────────────────────────────────────────────
  const svcPlacements = {}
  let sx = svcX0
  for (const r of svcOrder) {
    svcPlacements[r.id] = { x: sx, y: 0, w: r.w, d: r.d }
    sx += r.w
  }

  const ground = {
    trafo1:      { x: trafoX,             y: 0,                      w: TRAFO_W,      d: TRAFO1_D },
    trafo2:      { x: trafoX,             y: TRAFO1_D,               w: TRAFO_W,      d: TRAFO2_D },
    ...svcPlacements,
    // Repair zone at NORTH end of crane zone (near dock hatch — equipment is lifted in)
    repair_zone: { x: craneX,             y: SERVICE_BELT,           w: CRANE_ZONE_W, d: repairD   },
    // Parking at SOUTH end of crane zone (accessible from south exterior)
    parking:     { x: craneX,             y: SERVICE_BELT + repairD, w: CRANE_ZONE_W, d: parkingD  },
    dock1:       { x: craneX + dock1XOff, y: SERVICE_BELT,           w: DOCK_W,       d: DOCK_W    },
  }

  // ── Level 1 ─────────────────────────────────────────────────────
  const fanX  = trafoEast ? 0        : bW - FAN_ROOM_W
  const lvX   = trafoEast ? bW - lvW : 0
  const corrX = trafoEast ? bW - lvW - CORRIDOR_W : lvW
  const pumpX = trafoEast ? 0        : lvW + CORRIDOR_W
  const rwW   = bW - lvW - CORRIDOR_W
  const cpW   = snap(bW * R_CP_W)
  const cpD   = cpSplitY - FAN_ROOM_D
  const rwD   = bD - cpSplitY

  const dock2X = fanX + 2000 + dock2XOff
  const dock2Y = FAN_ROOM_D - DOCK_W - 1000

  const level1 = {
    fan_room:    { x: fanX,   y: 0,          w: FAN_ROOM_W, d: FAN_ROOM_D          },
    dock2:       { x: dock2X, y: dock2Y,     w: DOCK_W,     d: DOCK_W              },
    lv_control:  { x: lvX,    y: 0,          w: lvW,        d: LV_D                },
    clean_pump:  { x: pumpX,  y: FAN_ROOM_D, w: cpW,        d: cpD                 },
    rainwater:   { x: pumpX,  y: cpSplitY,   w: rwW,        d: rwD                 },
    corridor_l1: { x: corrX,  y: FAN_ROOM_D, w: CORRIDOR_W, d: bD - FAN_ROOM_D     },
  }

  // ── Assemble ────────────────────────────────────────────────────
  const svcLabels = { meter_main: '总水表', meter_sub: '水表', fire_equip: '消防' }
  const svcDesc   = svcOrder.map(r => svcLabels[r.id]).join('→')
  const sideLabel = trafoEast ? '变压器东置' : '变压器西置'
  const arRatio   = (bD / bW).toFixed(2)

  return {
    id:          `A-${groupId}-${variantIdx}`,
    label:       `维修区居中·${sideLabel}`,
    desc:        `建筑 ${(bW / 1000).toFixed(1)}m×${(bD / 1000).toFixed(1)}m（长宽比 ${arRatio}）` +
                 `·${sideLabel}·服务用房 ${svcDesc}` +
                 `·维修区 ${Math.round(repairD * CRANE_ZONE_W / 1e6)} m²` +
                 `·停车区 ${Math.round(parkingD * CRANE_ZONE_W / 1e6)} m²`,
    ground,
    level1,
    buildingW:   bW,
    buildingD:   bD,
    groupId,
    variantIdx,
    aspectRatio: parseFloat(arRatio),
    crane15:     { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: craneZoneD },
    crane5:      { x: fanX,   y: 0,            w: FAN_ROOM_W,   d: FAN_ROOM_D },
  }
}

// ── Constraint evaluator ──────────────────────────────────────────────

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
    feasible:         violations.length === 0,
    placements:       allPlacements,
    groundPlacements: template.ground,
    level1Placements: template.level1,
    violations,
    adjacency,
    template,
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate and evaluate 5 + 6×3 = 23 Template A variants.
 *
 * Group S  (5 variants): user-specified building dimensions, seeds 0–4
 * Groups R1.0 … R2.4  (3 variants each, seeds 0–2):
 *   same floor area as the user building, reshaped to standard aspect ratios.
 *
 * @param {object} userParams
 * @param {number} [userParams.buildingW=18600]  Building width (mm)
 * @param {number} [userParams.buildingD=24000]  Building depth (mm)
 * @param {object} [userParams.roomAreas={}]     Target areas per room (m²)
 * @returns {Array} 23 evaluated variants
 */
export function generateTemplateAVariants(userParams = {}) {
  const bW        = snap(userParams.buildingW || BASE_BW)
  const bD        = snap(userParams.buildingD || BASE_BD)
  const roomAreas = userParams.roomAreas || {}

  const variants = []

  // ── Group S: 5 variants at user dimensions ────────────────────
  for (let i = 0; i < 5; i++) {
    const t = generateTemplateA(i, bW, bD, roomAreas, 'S', i + 1)
    variants.push(evaluateGrownTemplate(t))
  }

  // ── Groups R*: 3 variants per standard aspect ratio ───────────
  // Each group uses seeds 0–2 (same random patterns at a different shape)
  // so you can compare how aspect ratio changes the layout quality.
  const baseArea = bW * bD
  for (const ratio of ASPECT_RATIOS) {
    // BD / BW = ratio  →  BW = sqrt(A/r), BD = sqrt(A·r)
    const newBW = snap(Math.sqrt(baseArea / ratio))
    const newBD = snap(Math.sqrt(baseArea * ratio))
    const ratioLabel = `R${ratio.toFixed(1)}`

    for (let i = 0; i < 3; i++) {
      const t = generateTemplateA(i, newBW, newBD, roomAreas, ratioLabel, i + 1)
      variants.push(evaluateGrownTemplate(t))
    }
  }

  return variants  // 5 + 18 = 23 variants
}
