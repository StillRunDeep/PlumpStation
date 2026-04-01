/**
 * Three building layout templates.
 * Each template defines exact room placements (x, y, w, d) in mm,
 * with (0,0) at the building's NW interior corner, X→east, Y→south.
 *
 * repair_zone is derived from the parking bounding box + 500mm margin.
 * dock1 / dock2 are placed within their respective operational zones.
 */

// ──────────────────────────────────────────────────────────────────
//  Template A: 变压器东置
//  Trafo rooms stack on the east side; small service rooms line the
//  north wall (west section); parking + repair zone in the centre.
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_A = {
  id: 'A',
  label: '变压器东置',
  desc: '变压器集中在建筑东侧，停车及维修区居中，水表/消防沿北墙西侧排列。东侧变压器可双面自然通风。',

  // ── Ground floor placements (mm) ──
  ground: {
    // Service rooms along north wall
    meter_main:  { x: 0,     y: 0,    w: 2800, d: 3400 },
    meter_sub:   { x: 2800,  y: 0,    w: 2800, d: 3300 },
    fire_equip:  { x: 5600,  y: 0,    w: 2800, d: 2500 },
    // Trafo rooms on east side
    trafo1:      { x: 10000, y: 0,    w: 8600, d: 8000 },
    trafo2:      { x: 10000, y: 8000, w: 8600, d: 8000 },
    // Parking in central-west zone (below service rooms)
    parking:     { x: 0,     y: 3400, w: 10000, d: 17200 },
    // Delivery hatch within parking, near centre
    dock1:       { x: 3500,  y: 3400, w: 3000,  d: 3000 },
    // repair_zone spans parking + 500mm margin each side → derived
    repair_zone: { x: 0,     y: 3400, w: 10000, d: 17200 }, // same as parking (margin in visual only)
  },

  // ── Level 1 placements ──
  level1: {
    fan_room:    { x: 0,     y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 10600, y: 8800,  w: 3000,  d: 3000  },
    lv_control:  { x: 10600, y: 0,     w: 8000,  d: 17500 },
    clean_pump:  { x: 0,     y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 0,     y: 14500, w: 9000,  d: 6100  },
  },

  // Building footprint (mm)
  buildingW: 18600,   // 10000 (parking) + 8600 (trafo)
  buildingD: 20600,   // 3400 (service strip) + 17200 (parking)

  // Crane coverages (for constraint display)
  crane15: { x: 0, y: 3400, w: 10000, d: 17200 },  // covers parking + dock1
  crane5:  { x: 0, y: 0,    w: 13600, d: 11800 },  // covers fan_room + dock2
}

// ──────────────────────────────────────────────────────────────────
//  Template B: 变压器西置
//  Mirror of A: trafo rooms on the west, service rooms on the NE,
//  parking + repair zone in the centre-east.
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_B = {
  id: 'B',
  label: '变压器西置',
  desc: '变压器集中在建筑西侧，停车及维修区居中，水表/消防沿北墙东侧。适合场地西侧有变电站接入点的情况。',

  ground: {
    trafo1:      { x: 0,    y: 0,    w: 8600, d: 8000 },
    trafo2:      { x: 0,    y: 8000, w: 8600, d: 8000 },
    meter_main:  { x: 8600, y: 0,    w: 2800, d: 3400 },
    meter_sub:   { x: 11400,y: 0,    w: 2800, d: 3300 },
    fire_equip:  { x: 14200,y: 0,    w: 2800, d: 2500 },
    parking:     { x: 8600, y: 3400, w: 10000, d: 17200 },
    dock1:       { x: 12100,y: 3400, w: 3000,  d: 3000 },
    repair_zone: { x: 8600, y: 3400, w: 10000, d: 17200 },
  },

  level1: {
    lv_control:  { x: 0,     y: 0,     w: 8000,  d: 17500 },
    fan_room:    { x: 5000,  y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 5000,  y: 8800,  w: 3000,  d: 3000  },
    clean_pump:  { x: 9600,  y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 9600,  y: 14500, w: 9000,  d: 5600  },
  },

  buildingW: 18600,
  buildingD: 20600,

  crane15: { x: 8600, y: 3400, w: 10000, d: 17200 },
  crane5:  { x: 5000, y: 0,   w: 13600, d: 11800 },
}

// ──────────────────────────────────────────────────────────────────
//  Template C: 变压器北排
//  Both trafo rooms sit side-by-side along the north wall; service
//  rooms run along the east; parking + repair south of trafos.
//  Produces a wider, shallower footprint.
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_C = {
  id: 'C',
  label: '变压器北排',
  desc: '两台变压器并排于建筑北侧，形成较宽较浅的体形，停车及维修区在南半部。适合场地进深受限的情况。',

  ground: {
    trafo1:      { x: 0,     y: 0,    w: 8600,  d: 8000 },
    trafo2:      { x: 8600,  y: 0,    w: 8600,  d: 8000 },
    meter_main:  { x: 17200, y: 0,    w: 2800,  d: 3400 },
    meter_sub:   { x: 17200, y: 3400, w: 2800,  d: 3300 },
    fire_equip:  { x: 17500, y: 6700, w: 2500,  d: 2800 }, // rotated, flush to east wall
    parking:     { x: 4100,  y: 8000, w: 10000, d: 17200 },
    dock1:       { x: 7600,  y: 8000, w: 3000,  d: 3000 },
    repair_zone: { x: 4100,  y: 8000, w: 10000, d: 17200 },
  },

  level1: {
    fan_room:    { x: 0,     y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 10600, y: 8800,  w: 3000,  d: 3000  },
    lv_control:  { x: 10600, y: 0,     w: 9000,  d: 17500 },
    clean_pump:  { x: 0,     y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 0,     y: 14500, w: 9000,  d: 6000  },
  },

  buildingW: 20000,   // 8600+8600+2800 = 20000
  buildingD: 25200,   // 8000 (trafo) + 17200 (parking)

  crane15: { x: 4100, y: 8000, w: 10000, d: 17200 },
  crane5:  { x: 0,   y: 0,    w: 13600, d: 11800 },
}

export const ALL_TEMPLATES = [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C]
