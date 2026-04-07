/**
 * Constraint-growth generator for Template A variants.
 *
 * Template A: 维修区居中 (repair/parking zone in the centre)
 *
 * Randomness strategy — seed-position based, not area-derived:
 *   Each room (or pair of competing rooms) receives one or two random seed
 *   coordinates within its valid zone.  Room sizes emerge from the resulting
 *   spatial partition; they may differ from any user-supplied area targets.
 *
 * 13 independent random dimensions per seed (all positional, none area-derived):
 *   D-01  trafoEast        — trafo block on east or west
 *   D-02  svcOrder         — service room L-R order (3! = 6 permutations)
 *   D-03  craneZoneSplitEW — crane zone: E-W partition (30 %) vs N-S (70 %)
 *   D-04  repairSeedRatio  — repair_zone seed within crane zone
 *   D-05  parkingSeedRatio — parking seed within crane zone
 *                            (split line = midpoint of seeds; northward /
 *                             westward seed → that room gets that sub-zone)
 *   D-06  trafoSeedRatio   — Y-start of trafo block (random offset in zone)
 *   D-07  dock1SeedXRatio  — dock1 x within crane zone
 *   D-08  dock1SeedYRatio  — dock1 y within crane zone
 *   D-09  lvWRatio         — lv_control width in [lvWMin..lvWMax]
 *   D-10  fanDRatio        — fan room depth: 35 %..60 % of bD
 *   D-11  cpSeedRatio      — clean_pump seed in pump zone
 *   D-12  rwSeedRatio      — rainwater seed in pump zone
 *                            (same midpoint-split logic as D-04/D-05)
 *   D-13  dock2XRatio      — dock2 x offset within fan room
 *
 * Coordinates: (0,0) = NW interior corner, X→east, Y→south, units mm.
 */

import { checkAdjacency } from './adjacency.js'
import { CONSTRAINT_CHECKS } from './placer.js'
import { ROOM_DEFS } from './room-defs.js'

// ── Reference building dimensions ────────────────────────────────────
const BASE_BW = 18600
const BASE_BD = 24000

// Proportional ratios from the reference building (structural constraints)
const R_CRANE_W  = 10000 / BASE_BW   // crane zone width  / building width
const R_SERVICE  = 3400  / BASE_BD   // service belt depth / building depth
const R_TRAFO_D  = 8000  / BASE_BD   // single trafo depth / building depth
const R_FAN_W    = 13600 / BASE_BW   // fan room width    / building width
const R_LV_W_MIN = 7500  / BASE_BW   // lv_control min-width ratio
const R_LV_W_MAX = 9000  / BASE_BW   // lv_control max-width ratio
const R_LV_D     = 17500 / BASE_BD   // lv_control depth ratio
const R_CP_W     = 6500  / BASE_BW   // clean_pump width ratio

// Fixed dimensions
const CORRIDOR_W = 1600   // Level-1 corridor minimum clear width (mm)
const DOCK_W     = 3000   // delivery hatch square size (mm)
const MIN_ROOM_D = 2000   // minimum room depth to prevent degenerate rooms (mm)
const MIN_ROOM_W = 2000   // minimum room width

// Ground floor service rooms
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

/**
 * Partition a 1-D zone of length `zoneLen` between two competing rooms using
 * seed-position growth.
 *
 * Each room receives a random seed ratio in [seedMin, seedMax].  The partition
 * line is the midpoint of the two seeds, clamped so each side is at least
 * `minLen` units.  The room whose seed is closer to 0 (i.e. "first" in the
 * zone) receives the lower half; the other receives the upper half.
 *
 * @param {number} zoneLen   Total length of zone
 * @param {number} seedA     Seed ratio [0,1] for room A
 * @param {number} seedB     Seed ratio [0,1] for room B
 * @param {number} minLen    Minimum length for each partition (mm)
 * @returns {{ firstLen: number, secondLen: number, aIsFirst: boolean }}
 *   firstLen/secondLen are actual lengths; aIsFirst=true means room A occupies
 *   the lower (first) portion.
 */
function seedPartition1D(zoneLen, seedA, seedB, minLen = MIN_ROOM_D) {
  const posA = seedA * zoneLen
  const posB = seedB * zoneLen
  // Midpoint of the two seed positions → natural partition line
  let splitPos = (posA + posB) / 2
  // Clamp so each sub-zone is at least minLen
  splitPos = Math.max(minLen, Math.min(zoneLen - minLen, splitPos))
  const firstLen  = snap(splitPos)
  const secondLen = zoneLen - firstLen
  // Room A occupies the sub-zone that contains its seed
  const aIsFirst = posA < posB
  return { firstLen, secondLen, aIsFirst }
}

// ── Single variant generator ──────────────────────────────────────────

/**
 * Generate one Template A variant.
 *
 * @param {number} seed      Integer RNG seed
 * @param {number} bW        Building width (mm), east-west
 * @param {number} bD        Building depth (mm), north-south
 * @param {object} roomAreas User target areas (m²) — accepted for reference only;
 *                           not used to derive room positions.  Sizes emerge from
 *                           seed-position growth and may differ from targets.
 */
export function generateTemplateA(seed, bW, bD, roomAreas = {}) {
  const rng = makeRng(seed)

  // ── Structural zone dimensions (from building proportions) ───────
  const CRANE_ZONE_W = snap(bW * R_CRANE_W)
  const TRAFO_W      = bW - CRANE_ZONE_W
  const SERVICE_BELT = snap(bD * R_SERVICE)
  const TRAFO1_D     = snap(bD * R_TRAFO_D)
  const TRAFO2_D     = snap(bD * R_TRAFO_D)
  const FAN_ROOM_W   = snap(bW * R_FAN_W)
  const craneZoneD   = bD - SERVICE_BELT

  const lvWMin = snap(bW * R_LV_W_MIN)
  const lvWMax = snap(bW * R_LV_W_MAX)

  const SVC = SVC_PROPS.map(r => ({
    id: r.id,
    w:  snap(bW * r.wR),
    d:  snap(bD * r.dR),
  }))

  // ── Random decisions (consume in fixed order) ─────────────────────

  // D-01 Trafo block side
  const trafoEast = rng() < 0.5

  // D-02 Service room order (consumes 2 RNG values for 3-element shuffle)
  const svcOrder = shuffle(SVC, rng)

  // D-03 Crane zone split orientation
  const craneZoneSplitEW = rng() < 0.30   // 30 % → E-W, 70 % → N-S

  // D-04/D-05 Seed ratios for repair_zone and parking within crane zone
  // Valid seed range: [0.05, 0.95] ensures seeds are well inside the zone
  const repairSeedRatio = 0.05 + rng() * 0.90
  const parkingSeedRatio = 0.05 + rng() * 0.90

  // D-06 Trafo block Y-start seed within trafo zone
  const trafoSeedRatio = rng()

  // D-07/D-08 dock1 seed position within crane zone (both axes random)
  const dock1SeedXRatio = rng()
  const dock1SeedYRatio = rng()

  // D-09 lv_control width seed
  const lvWRatio = rng()

  // D-10 fan room depth seed (35 %..60 % of bD)
  const fanDRatio = rng()

  // D-11/D-12 Seed ratios for clean_pump and rainwater within pump zone
  const cpSeedRatio = 0.05 + rng() * 0.90
  const rwSeedRatio = 0.05 + rng() * 0.90

  // D-13 dock2 x offset within fan room
  const dock2XRatio = rng()

  // ── Zone origins ────────────────────────────────────────────────────
  const craneX    = trafoEast ? 0           : TRAFO_W
  const trafoZoneX = trafoEast ? CRANE_ZONE_W : 0

  // ── Trafo zone — random Y-start for trafo block ─────────────────────
  const trafoBlockH  = TRAFO1_D + TRAFO2_D
  const trafoYRange  = Math.max(0, bD - trafoBlockH)
  const trafoStartY  = snap(trafoSeedRatio * trafoYRange)

  // ── Crane zone — seed-position partition ─────────────────────────────
  let repairRect, parkingRect

  if (craneZoneSplitEW) {
    // East-west partition: each room spans full crane zone depth, split E-W
    const { firstLen: westW, secondLen: eastW, aIsFirst: repairOnWest } =
      seedPartition1D(CRANE_ZONE_W, repairSeedRatio, parkingSeedRatio, MIN_ROOM_W)
    const splitX = craneX + westW
    repairRect  = repairOnWest
      ? { x: craneX, y: SERVICE_BELT, w: westW, d: craneZoneD }
      : { x: splitX, y: SERVICE_BELT, w: eastW, d: craneZoneD }
    parkingRect = repairOnWest
      ? { x: splitX, y: SERVICE_BELT, w: eastW, d: craneZoneD }
      : { x: craneX, y: SERVICE_BELT, w: westW, d: craneZoneD }
  } else {
    // North-south partition: each room spans full crane zone width, split N-S
    const { firstLen: northD, secondLen: southD, aIsFirst: repairOnNorth } =
      seedPartition1D(craneZoneD, repairSeedRatio, parkingSeedRatio, MIN_ROOM_D)
    const splitY = SERVICE_BELT + northD
    repairRect  = repairOnNorth
      ? { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: northD }
      : { x: craneX, y: splitY,       w: CRANE_ZONE_W, d: southD }
    parkingRect = repairOnNorth
      ? { x: craneX, y: splitY,       w: CRANE_ZONE_W, d: southD }
      : { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: northD }
  }

  // ── dock1 — random position anywhere within crane zone ──────────────
  const dock1X = snap(craneX       + dock1SeedXRatio * Math.max(0, CRANE_ZONE_W - DOCK_W - 200))
  const dock1Y = snap(SERVICE_BELT + dock1SeedYRatio * Math.max(0, craneZoneD   - DOCK_W - 200))

  // ── Ground floor ─────────────────────────────────────────────────────
  const svcPlacements = {}
  let sx = craneX
  for (const r of svcOrder) {
    svcPlacements[r.id] = { x: sx, y: 0, w: r.w, d: r.d }
    sx += r.w
  }

  const ground = {
    trafo1:      { x: trafoZoneX, y: trafoStartY,            w: TRAFO_W,      d: TRAFO1_D  },
    trafo2:      { x: trafoZoneX, y: trafoStartY + TRAFO1_D, w: TRAFO_W,      d: TRAFO2_D  },
    ...svcPlacements,
    repair_zone: repairRect,
    parking:     parkingRect,
    dock1:       { x: dock1X, y: dock1Y, w: DOCK_W, d: DOCK_W },
  }

  // ── Level 1 ───────────────────────────────────────────────────────────

  // lv_control width — random within structural range
  const lvW = snap(lvWMin + lvWRatio * (lvWMax - lvWMin))

  // fan room depth — seed determines how far south the fan room reaches (35-60 % of bD)
  const FAN_ROOM_D = snap(bD * (0.35 + fanDRatio * 0.25))

  // Pump zone: everything south of the fan room
  const pumpZoneStart = FAN_ROOM_D
  const pumpZoneD     = bD - FAN_ROOM_D

  // clean_pump / rainwater — seed-position partition within pump zone
  const { firstLen: cpD, secondLen: rwD, aIsFirst: cpIsNorth } =
    seedPartition1D(pumpZoneD, cpSeedRatio, rwSeedRatio, MIN_ROOM_D)
  const splitPumpY = pumpZoneStart + cpD

  // Room assignment: seed closer to fan room (smaller ratio) → northward position
  const cpY = cpIsNorth ? pumpZoneStart : splitPumpY
  const rwY = cpIsNorth ? splitPumpY   : pumpZoneStart
  const cpD_actual = cpIsNorth ? cpD : rwD
  const rwD_actual = cpIsNorth ? rwD : cpD

  const fanX  = trafoEast ? 0        : bW - FAN_ROOM_W
  const lvX   = trafoEast ? bW - lvW : 0
  const corrX = trafoEast ? lvX - CORRIDOR_W : lvW
  const pumpX = trafoEast ? 0        : lvW + CORRIDOR_W
  const rwW   = bW - lvW - CORRIDOR_W
  const cpW   = snap(bW * R_CP_W)

  // dock2 — random x offset within fan room, y just inside fan room south edge
  const dock2XMax = Math.max(0, FAN_ROOM_W - DOCK_W - 4000)
  const dock2X = fanX + 2000 + snap(dock2XRatio * dock2XMax)
  const dock2Y = Math.max(0, FAN_ROOM_D - DOCK_W - 1000)

  const LV_D = snap(bD * R_LV_D)

  const level1 = {
    fan_room:    { x: fanX,   y: 0,            w: FAN_ROOM_W, d: FAN_ROOM_D   },
    dock2:       { x: dock2X, y: dock2Y,       w: DOCK_W,     d: DOCK_W       },
    lv_control:  { x: lvX,   y: 0,            w: lvW,        d: LV_D         },
    clean_pump:  { x: pumpX, y: cpY,           w: cpW,        d: cpD_actual   },
    rainwater:   { x: pumpX, y: rwY,           w: rwW,        d: rwD_actual   },
    corridor_l1: { x: corrX, y: FAN_ROOM_D,   w: CORRIDOR_W, d: bD - FAN_ROOM_D },
  }

  // ── Assemble ──────────────────────────────────────────────────────────
  const svcLabels = { meter_main: '总水表', meter_sub: '水表', fire_equip: '消防' }
  const svcDesc   = svcOrder.map(r => svcLabels[r.id]).join('→')
  const sideLabel = trafoEast ? '变压器东置' : '变压器西置'
  const splitLabel = craneZoneSplitEW ? '起重机区E-W分' : '起重机区N-S分'
  const cpNS      = cpIsNorth ? '清洁泵北' : '清洁泵南'
  const arRatio   = (bD / bW).toFixed(2)

  const repairAreaM2 = Math.round(repairRect.w * repairRect.d / 1e6)
  const parkingAreaM2 = Math.round(parkingRect.w * parkingRect.d / 1e6)
  const cpAreaM2  = Math.round(cpW * cpD_actual / 1e6)
  const rwAreaM2  = Math.round(rwW * rwD_actual / 1e6)

  return {
    id:       `A-${seed.toString(16).slice(-6).toUpperCase()}`,
    label:    `维修区居中·${sideLabel}`,
    desc:     `建筑 ${(bW / 1000).toFixed(1)}m×${(bD / 1000).toFixed(1)}m（长宽比 ${arRatio}）` +
              `·${sideLabel}·${splitLabel}·${cpNS}·服务用房 ${svcDesc}` +
              `·维修区 ${repairAreaM2} m²·停车区 ${parkingAreaM2} m²` +
              `·清洁泵 ${cpAreaM2} m²·雨水房 ${rwAreaM2} m²`,
    ground,
    level1,
    buildingW: bW,
    buildingD: bD,
    crane15:   { x: craneX, y: SERVICE_BELT, w: CRANE_ZONE_W, d: craneZoneD },
    crane5:    { x: fanX,   y: 0,            w: FAN_ROOM_W,   d: FAN_ROOM_D },
  }
}
