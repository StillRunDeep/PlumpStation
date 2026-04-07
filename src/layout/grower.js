/**
 * Constraint-growth generator for Template A variants.
 *
 * Template A: 维修区居中 (repair/parking zone in the centre)
 *
 * Building dimensions are user-parameterised. All zone geometry scales
 * proportionally from the reference building (18600 W × 24000 D mm).
 *
 * Per-seed random decisions:
 *   1.  Trafo block side: east or west
 *   2.  Service room left-right order (3! permutations of meter_main/sub/fire_equip)
 *   3.  lv_control width: lvWMin..lvWMax (scaled); ±500 mm jitter when area override
 *   4.  clean_pump / rainwater Y-split within a valid range; ±300 mm jitter
 *   5.  Parking/repair crane-zone split (from user target area + ±5 % jitter)
 *   6.  dock1 x-offset within crane zone, dock2 x-offset within fan_room
 *   7.  parkingNorth: parking at north end of crane zone, repair at south (or vice versa)
 *   8.  cpAbove: clean_pump above rainwater in level-1 (or below)
 *   9.  fan_room depth variation: ±8 % of proportional value (or from user area)
 *   10. Extra parking jitter even when user provides an area target
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
const R_PARKING_D    = 17200 / BASE_BD   // default parking depth ratio

// Fixed dimensions (not scaled with building size)
const CORRIDOR_W = 1600   // Level-1 corridor minimum clear width (mm)
const DOCK_W     = 3000   // delivery hatch square size (mm)

// Ground floor service rooms — proportions of reference building
const SVC_PROPS = [
  { id: 'meter_main', wR: 2800 / BASE_BW, dR: 3400 / BASE_BD },
  { id: 'meter_sub',  wR: 2800 / BASE_BW, dR: 3300 / BASE_BD },
  { id: 'fire_equip', wR: 2800 / BASE_BW, dR: 2500 / BASE_BD },
]

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
 *                            Recognised keys: parking, repair_zone, lv_control,
 *                            clean_pump, fan_room, rainwater
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

  // ── Random decisions (consume RNG in fixed order for reproducibility) ──

  // Decision 1: trafo side
  const trafoEast = rng() < 0.5

  // Decision 2: service room order (consumes 2 RNG values for 3-element shuffle)
  const svcOrder = shuffle(SVC, rng)

  // Decisions 3-4: continuous parameters — always consume 2 values each so that
  // downstream decisions are identical regardless of which branch is taken.
  const rv_lv1 = rng(), rv_lv2 = rng()   // lv_control width
  const rv_cp1 = rng(), rv_cp2 = rng()   // cpSplitY

  // Decision 5: parking/repair split base jitter
  const rv_pk1 = rng()

  // Decisions 6a-b: dock offsets
  const dock1XOff = snap(rng() * Math.max(0, CRANE_ZONE_W - DOCK_W - 200))
  const dock2XMax = Math.max(0, FAN_ROOM_W - DOCK_W - 4000)
  const dock2XOff = dock2XMax > 0 ? snap(rng() * dock2XMax) : 0

  // Decision 7: parking north/south swap
  const parkingNorth = rng() < 0.5   // true → parking at north, repair at south

  // Decision 8: clean_pump / rainwater vertical swap in level 1
  const cpAbove = rng() < 0.5        // true → clean_pump above (north of) rainwater

  // Decision 9: fan room depth variation
  const rv_fan = rng()

  // Decision 10: extra parking jitter (used even with user area override)
  const rv_pk2 = rng()

  // ── Fan room depth ───────────────────────────────────────────────
  // Variable: user area takes precedence; otherwise ±8 % variation around ratio.
  let FAN_ROOM_D
  if (roomAreas.fan_room > 0) {
    const derived = snap(roomAreas.fan_room * 1e6 / FAN_ROOM_W)
    const jitter  = snap((rv_fan - 0.5) * 1200)  // ±600 mm
    FAN_ROOM_D = Math.max(snap(bD * 0.30), Math.min(snap(bD * 0.60), derived + jitter))
  } else {
    const fanDBase = snap(bD * R_FAN_D)
    FAN_ROOM_D = snap(fanDBase * 0.92 + rv_fan * fanDBase * 0.16)  // ±8 % range
  }

  // Scaled cpSplitY range (recomputed after FAN_ROOM_D is known so the split is
  // always above the fan room)
  const cpD_ref     = snap((17500 - 11800) * bD / BASE_BD)  // reference cp depth
  const cpSplitYMin = FAN_ROOM_D + snap(cpD_ref * 0.80)
  const cpSplitYMax = FAN_ROOM_D + snap(cpD_ref * 1.25)

  // ── lv_control width ────────────────────────────────────────────
  let lvW
  if (roomAreas.lv_control > 0) {
    const derived = snap(roomAreas.lv_control * 1e6 / LV_D)
    const jitter  = snap((rv_lv1 - 0.5) * 1000)  // ±500 mm
    lvW = Math.max(lvWMin, Math.min(lvWMax, derived + jitter))
  } else {
    lvW = snap(lvWMin + rv_lv2 * (lvWMax - lvWMin))
  }

  // ── clean_pump / rainwater Y-split ──────────────────────────────
  let cpSplitY
  if (roomAreas.clean_pump > 0) {
    const cpW_approx = snap(bW * R_CP_W)
    const cpD_target = snap(roomAreas.clean_pump * 1e6 / cpW_approx)
    const derived    = FAN_ROOM_D + cpD_target
    const jitter     = snap((rv_cp1 - 0.5) * 600)  // ±300 mm
    cpSplitY = Math.max(cpSplitYMin, Math.min(cpSplitYMax, derived + jitter))
  } else if (roomAreas.rainwater > 0) {
    // Derive split from rainwater target area
    const rwW_approx = bW - lvW - CORRIDOR_W
    const rwD_target = snap(roomAreas.rainwater * 1e6 / Math.max(rwW_approx, 1000))
    const derived    = bD - rwD_target
    const jitter     = snap((rv_cp1 - 0.5) * 600)
    cpSplitY = Math.max(cpSplitYMin, Math.min(cpSplitYMax, derived + jitter))
  } else {
    cpSplitY = snap(cpSplitYMin + rv_cp2 * (cpSplitYMax - cpSplitYMin))
  }

  // ── Parking / repair split within crane zone ─────────────────────
  let parkingD
  if (roomAreas.parking > 0) {
    parkingD = snap(roomAreas.parking * 1e6 / CRANE_ZONE_W)
    // Apply ±5 % jitter even with user override for layout variety
    const jitter = snap((rv_pk2 - 0.5) * craneZoneD * 0.10)
    parkingD = Math.max(2000, Math.min(craneZoneD - 2000, parkingD + jitter))
  } else if (roomAreas.repair_zone > 0) {
    const repD   = snap(roomAreas.repair_zone * 1e6 / CRANE_ZONE_W)
    const jitter = snap((rv_pk2 - 0.5) * craneZoneD * 0.10)
    parkingD = Math.max(2000, Math.min(craneZoneD - 2000, craneZoneD - repD + jitter))
  } else {
    // Proportional default with ±15 % random range
    const defParkingD = snap(bD * R_PARKING_D)
    const jitter      = snap((rv_pk1 - 0.5) * craneZoneD * 0.30)
    parkingD = Math.max(2000, Math.min(craneZoneD - 2000, defParkingD + jitter))
  }
  const repairD = craneZoneD - parkingD

  // ── Zone origins ────────────────────────────────────────────────
  const craneX = trafoEast ? 0        : TRAFO_W
  const trafoX = trafoEast ? CRANE_ZONE_W : 0
  const svcX0  = craneX

  // ── Ground floor ────────────────────────────────────────────────
  const svcPlacements = {}
  let sx = svcX0
  for (const r of svcOrder) {
    svcPlacements[r.id] = { x: sx, y: 0, w: r.w, d: r.d }
    sx += r.w
  }

  // Parking/repair north-south position: parkingNorth=true → parking at north
  // end of crane zone (beside service rooms), repair at south end.
  const repairZoneY  = parkingNorth ? SERVICE_BELT + parkingD : SERVICE_BELT
  const parkingZoneY = parkingNorth ? SERVICE_BELT            : SERVICE_BELT + repairD

  const ground = {
    trafo1:      { x: trafoX,              y: 0,            w: TRAFO_W,      d: TRAFO1_D  },
    trafo2:      { x: trafoX,              y: TRAFO1_D,     w: TRAFO_W,      d: TRAFO2_D  },
    ...svcPlacements,
    repair_zone: { x: craneX,             y: repairZoneY,  w: CRANE_ZONE_W, d: repairD   },
    parking:     { x: craneX,             y: parkingZoneY, w: CRANE_ZONE_W, d: parkingD  },
    dock1:       { x: craneX + dock1XOff, y: SERVICE_BELT, w: DOCK_W,       d: DOCK_W    },
  }

  // ── Level 1 ─────────────────────────────────────────────────────
  const fanX  = trafoEast ? 0        : bW - FAN_ROOM_W
  const lvX   = trafoEast ? bW - lvW : 0
  const corrX = trafoEast ? bW - lvW - CORRIDOR_W : lvW
  const pumpX = trafoEast ? 0        : lvW + CORRIDOR_W
  const rwW   = bW - lvW - CORRIDOR_W
  const cpW   = snap(bW * R_CP_W)

  // Vertical dimensions for clean_pump / rainwater
  const cpD = cpSplitY - FAN_ROOM_D
  const rwD = bD - cpSplitY

  // cpAbove=true  → clean_pump is north (top), rainwater is south (bottom)
  // cpAbove=false → rainwater is north, clean_pump is south
  const cpY      = cpAbove ? FAN_ROOM_D : cpSplitY
  const rwY      = cpAbove ? cpSplitY   : FAN_ROOM_D
  const cpD_act  = cpAbove ? cpD : rwD
  const rwD_act  = cpAbove ? rwD : cpD

  const dock2X = fanX + 2000 + dock2XOff
  const dock2Y = Math.max(0, FAN_ROOM_D - DOCK_W - 1000)

  const level1 = {
    fan_room:    { x: fanX,   y: 0,          w: FAN_ROOM_W, d: FAN_ROOM_D       },
    dock2:       { x: dock2X, y: dock2Y,     w: DOCK_W,     d: DOCK_W           },
    lv_control:  { x: lvX,   y: 0,          w: lvW,        d: LV_D             },
    clean_pump:  { x: pumpX, y: cpY,         w: cpW,        d: cpD_act          },
    rainwater:   { x: pumpX, y: rwY,         w: rwW,        d: rwD_act          },
    corridor_l1: { x: corrX, y: FAN_ROOM_D, w: CORRIDOR_W, d: bD - FAN_ROOM_D  },
  }

  // ── Assemble ────────────────────────────────────────────────────
  const svcLabels = { meter_main: '总水表', meter_sub: '水表', fire_equip: '消防' }
  const svcDesc   = svcOrder.map(r => svcLabels[r.id]).join('→')
  const sideLabel = trafoEast ? '变压器东置' : '变压器西置'
  const northSouthLabel = parkingNorth ? '停车区北置' : '停车区南置'
  const cpLabel   = cpAbove ? '清洁泵北' : '清洁泵南'
  const arRatio   = (bD / bW).toFixed(2)

  return {
    id:          `A-${groupId}-${variantIdx}`,
    label:       `维修区居中·${sideLabel}`,
    desc:        `建筑 ${(bW / 1000).toFixed(1)}m×${(bD / 1000).toFixed(1)}m（长宽比 ${arRatio}）` +
                 `·${sideLabel}·${northSouthLabel}·${cpLabel}` +
                 `·服务用房 ${svcDesc}` +
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
