/**
 * Three building layout templates.
 * Each template defines exact room placements (x, y, w, d) in mm,
 * with (0,0) at the building's NW interior corner, X→east, Y→south.
 *
 * Level-1 strategy:
 *   - clean_pump and rainwater are stacked N→S (no overlap), sharing a wall
 *   - corridor_l1 sits between the utility cluster (clean_pump/rainwater) and lv_control
 *   - dock2 is contained within fan_room (counts as adjacent via containment check)
 */

// ──────────────────────────────────────────────────────────────────
//  Template A: 变压器东置
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_A = {
  id: 'A',
  label: '变压器东置',
  desc: '变压器集中在建筑东侧，停车及维修区居中，水表/消防沿北墙西侧排列。东侧变压器可双面自然通风。',

  ground: {
    meter_main:  { x: 0,     y: 0,    w: 2800,  d: 3400  },
    meter_sub:   { x: 2800,  y: 0,    w: 2800,  d: 3300  },
    fire_equip:  { x: 5600,  y: 0,    w: 2800,  d: 2500  },
    trafo1:      { x: 10000, y: 0,    w: 8600,  d: 8000  },
    trafo2:      { x: 10000, y: 8000, w: 8600,  d: 8000  },
    parking:     { x: 0,     y: 3400, w: 10000, d: 17200 },
    dock1:       { x: 3500,  y: 3400, w: 3000,  d: 3000  },
    repair_zone: { x: 0,     y: 3400, w: 10000, d: 17200 },
  },

  level1: {
    fan_room:    { x: 0,    y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 10600,y: 8800,  w: 3000,  d: 3000  },  // inside fan_room
    lv_control:  { x: 10600,y: 0,     w: 8000,  d: 17500 },
    clean_pump:  { x: 0,    y: 11800, w: 6500,  d: 6100  },  // y: 11800–17900
    rainwater:   { x: 0,    y: 17900, w: 9000,  d: 6100  },  // y: 17900–24000 (below clean_pump, adjacent)
    // corridor between utility cluster (right x=9000) and lv_control (left x=10600)
    corridor_l1: { x: 9000, y: 11800, w: 1600,  d: 12200 },  // y: 11800–24000
  },

  buildingW: 18600,
  buildingD: 24000,  // extended: 11800 (fan) + 6100 (clean_pump) + 6100 (rainwater)

  crane15: { x: 0,    y: 3400, w: 10000, d: 17200 },
  crane5:  { x: 0,    y: 0,    w: 13600, d: 11800 },
}

// ──────────────────────────────────────────────────────────────────
//  Template B: 变压器西置
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_B = {
  id: 'B',
  label: '变压器西置',
  desc: '变压器集中在建筑西侧，停车及维修区居中，水表/消防沿北墙东侧。适合场地西侧有变电站接入点的情况。',

  ground: {
    trafo1:      { x: 0,     y: 0,    w: 8600,  d: 8000  },
    trafo2:      { x: 0,     y: 8000, w: 8600,  d: 8000  },
    meter_main:  { x: 8600,  y: 0,    w: 2800,  d: 3400  },
    meter_sub:   { x: 11400, y: 0,    w: 2800,  d: 3300  },
    fire_equip:  { x: 14200, y: 0,    w: 2800,  d: 2500  },
    parking:     { x: 8600,  y: 3400, w: 10000, d: 17200 },
    dock1:       { x: 12100, y: 3400, w: 3000,  d: 3000  },
    repair_zone: { x: 8600,  y: 3400, w: 10000, d: 17200 },
  },

  level1: {
    lv_control:  { x: 0,    y: 0,     w: 8000,  d: 17500 },
    fan_room:    { x: 5000, y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 5000, y: 8800,  w: 3000,  d: 3000  },  // inside fan_room
    clean_pump:  { x: 9600, y: 11800, w: 6500,  d: 6100  },  // y: 11800–17900
    rainwater:   { x: 9600, y: 17900, w: 9000,  d: 6100  },  // y: 17900–24000 (below clean_pump, adjacent)
    // corridor between lv_control (right=8000) and utility cluster (left=9600)
    corridor_l1: { x: 8000, y: 11800, w: 1600,  d: 12200 },  // y: 11800–24000
  },

  buildingW: 18600,
  buildingD: 24000,

  crane15: { x: 8600, y: 3400, w: 10000, d: 17200 },
  crane5:  { x: 5000, y: 0,   w: 13600, d: 11800  },
}

// ──────────────────────────────────────────────────────────────────
//  Template C: 变压器北排
// ──────────────────────────────────────────────────────────────────
export const TEMPLATE_C = {
  id: 'C',
  label: '变压器北排',
  desc: '两台变压器并排于建筑北侧，形成较宽较浅的体形，停车及维修区在南半部。适合场地进深受限的情况。',

  ground: {
    trafo1:      { x: 0,     y: 0,    w: 8600,  d: 8000  },
    trafo2:      { x: 8600,  y: 0,    w: 8600,  d: 8000  },
    meter_main:  { x: 17200, y: 0,    w: 2800,  d: 3400  },
    meter_sub:   { x: 17200, y: 3400, w: 2800,  d: 3300  },
    fire_equip:  { x: 17500, y: 6700, w: 2500,  d: 2800  },  // rotated, flush east wall
    parking:     { x: 4100,  y: 8000, w: 10000, d: 17200 },
    dock1:       { x: 7600,  y: 8000, w: 3000,  d: 3000  },
    repair_zone: { x: 4100,  y: 8000, w: 10000, d: 17200 },
  },

  level1: {
    fan_room:    { x: 0,    y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 10600,y: 8800,  w: 3000,  d: 3000  },  // inside fan_room
    lv_control:  { x: 10600,y: 0,     w: 9000,  d: 17500 },
    clean_pump:  { x: 0,    y: 11800, w: 6500,  d: 6100  },  // y: 11800–17900
    rainwater:   { x: 0,    y: 17900, w: 9000,  d: 6100  },  // y: 17900–24000 (below clean_pump, adjacent)
    // corridor between utility cluster (right x=9000) and lv_control (left x=10600)
    corridor_l1: { x: 9000, y: 11800, w: 1600,  d: 12200 },
  },

  buildingW: 20000,
  buildingD: 25200,

  crane15: { x: 4100, y: 8000, w: 10000, d: 17200 },
  crane5:  { x: 0,   y: 0,    w: 13600, d: 11800  },
}

export const ALL_TEMPLATES = [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C]
