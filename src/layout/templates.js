/**
 * Four building layout templates split into two conceptual groups:
 *
 * Group A — 维修区居中（泵房维护间 between service rooms and trafos）
 *   A1: 变压器东置  A2: 变压器西置 (mirror of A1)
 *
 * Group B — 停车间居中（parking as central zone, flanked by repair+service / trafo）
 *   B1: 变压器东置  B2: 变压器西置 (mirror of B1)
 *
 * Coordinates: (0,0) at building NW interior corner, X→east, Y→south, units mm.
 *
 * Level-1 layout shared strategy:
 *   - clean_pump and rainwater stacked N→S (no overlap), sharing a wall at y=17900
 *   - dock2 contained within fan_room (adjacency via containment)
 *   - corridor_l1 between fan_room zone and lv_control
 */

// ─────────────────────────────────────────────────────────────────────
//  Group A: 维修区居中
//  The crane zone (repair + parking) sits between service rooms and trafos.
//  A1 and A2 differ only in which side the trafos occupy.
//  buildingW = 10000 (crane zone) + 8600 (trafo) = 18600 mm
// ─────────────────────────────────────────────────────────────────────

export const TEMPLATE_A1 = {
  id: 'A1',
  label: '维修区居中·变压器东置',
  desc: '泵房维护及停车区居中（15t桥吊覆盖），变压器集中东侧，服务用房沿北墙西侧布置。变压器东侧可双面通风。',

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
    clean_pump:  { x: 0,    y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 0,    y: 17900, w: 9000,  d: 6100  },  // adjacent to clean_pump below
    corridor_l1: { x: 9000, y: 11800, w: 1600,  d: 12200 },  // between rainwater(r=9000) and lv_control(l=10600)
  },

  buildingW: 18600,
  buildingD: 24000,  // 11800 (fan_room) + 6100 (clean_pump) + 6100 (rainwater)

  crane15: { x: 0,    y: 3400, w: 10000, d: 17200 },
  crane5:  { x: 0,    y: 0,    w: 13600, d: 11800 },
}

export const TEMPLATE_A2 = {
  id: 'A2',
  label: '维修区居中·变压器西置',
  desc: '泵房维护及停车区居中，变压器集中西侧，服务用房沿北墙东侧布置。适合场地西侧有变电站接入点的情况。',

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
    clean_pump:  { x: 9600, y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 9600, y: 17900, w: 9000,  d: 6100  },  // adjacent to clean_pump below
    corridor_l1: { x: 8000, y: 11800, w: 1600,  d: 12200 },  // between lv_control(r=8000) and clean_pump(l=9600)
  },

  buildingW: 18600,
  buildingD: 24000,

  crane15: { x: 8600, y: 3400, w: 10000, d: 17200 },
  crane5:  { x: 5000, y: 0,   w: 13600, d: 11800  },
}

// ─────────────────────────────────────────────────────────────────────
//  Group B: 停车间居中
//  Parking occupies the central zone; repair/service cluster on one side,
//  transformer rooms on the other.
//  repair_zone is a separate narrower strip (4500 mm) for maintenance.
//  buildingW = 4500 (repair) + 10000 (parking) + 8600 (trafo) = 23100 mm
// ─────────────────────────────────────────────────────────────────────

export const TEMPLATE_B1 = {
  id: 'B1',
  label: '停车间居中·变压器东置',
  desc: '停车间居中为主要运输通道，西侧为泵房维修区及服务用房（水表/消防），东侧为变压器。维修区独立于停车区，减少相互干扰。',

  ground: {
    // Service rooms north-west, above repair zone
    meter_main:  { x: 0,     y: 0,    w: 2800,  d: 3400  },
    meter_sub:   { x: 2800,  y: 0,    w: 2800,  d: 3300  },
    fire_equip:  { x: 5600,  y: 0,    w: 2800,  d: 2500  },
    // Repair zone: narrow west strip for maintenance activities + pump access (dock1)
    repair_zone: { x: 0,     y: 3400, w: 4500,  d: 17200 },
    dock1:       { x: 750,   y: 3400, w: 3000,  d: 3000  },  // inside repair_zone
    // Parking: central zone for truck access
    parking:     { x: 4500,  y: 3400, w: 10000, d: 17200 },
    // Trafo rooms: east side
    trafo1:      { x: 14500, y: 0,    w: 8600,  d: 8000  },
    trafo2:      { x: 14500, y: 8000, w: 8600,  d: 8000  },
  },

  level1: {
    fan_room:    { x: 0,    y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 10600,y: 8800,  w: 3000,  d: 3000  },  // inside fan_room
    // Full-height corridor separating fan_room zone from lv_control
    corridor_l1: { x: 13600,y: 0,     w: 1500,  d: 24000 },
    lv_control:  { x: 15100,y: 0,     w: 8000,  d: 17500 },
    clean_pump:  { x: 0,    y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 0,    y: 17900, w: 9000,  d: 6100  },
  },

  buildingW: 23100,  // 4500 (repair) + 10000 (parking) + 8600 (trafo)
  buildingD: 24000,

  crane15: { x: 0,    y: 3400, w: 14500, d: 17200 },  // covers repair_zone + parking
  crane5:  { x: 0,    y: 0,    w: 13600, d: 11800 },
}

export const TEMPLATE_B2 = {
  id: 'B2',
  label: '停车间居中·变压器西置',
  desc: '停车间居中，西侧为变压器，东侧为泵房维修区及服务用房（水表/消防）。适合场地西侧有变电站接入点的情况。',

  ground: {
    // Trafo rooms: west side
    trafo1:      { x: 0,     y: 0,    w: 8600,  d: 8000  },
    trafo2:      { x: 0,     y: 8000, w: 8600,  d: 8000  },
    // Parking: central zone
    parking:     { x: 8600,  y: 3400, w: 10000, d: 17200 },
    dock1:       { x: 19350, y: 3400, w: 3000,  d: 3000  },  // inside repair_zone
    // Repair zone: narrow east strip
    repair_zone: { x: 18600, y: 3400, w: 4500,  d: 17200 },
    // Service rooms north-east, above repair zone
    fire_equip:  { x: 14700, y: 0,    w: 2800,  d: 2500  },
    meter_sub:   { x: 17500, y: 0,    w: 2800,  d: 3300  },
    meter_main:  { x: 20300, y: 0,    w: 2800,  d: 3400  },
  },

  level1: {
    lv_control:  { x: 0,    y: 0,     w: 8000,  d: 17500 },
    // Full-height corridor separating lv_control from fan_room zone
    corridor_l1: { x: 8000, y: 0,     w: 1500,  d: 24000 },
    fan_room:    { x: 9500, y: 0,     w: 13600, d: 11800 },
    dock2:       { x: 9500, y: 8800,  w: 3000,  d: 3000  },  // inside fan_room
    clean_pump:  { x: 16600,y: 11800, w: 6500,  d: 6100  },
    rainwater:   { x: 14100,y: 17900, w: 9000,  d: 6100  },  // adjacent to clean_pump below
  },

  buildingW: 23100,
  buildingD: 24000,

  crane15: { x: 8600, y: 3400, w: 14500, d: 17200 },  // covers parking + repair_zone
  crane5:  { x: 9500, y: 0,   w: 13600, d: 11800  },
}

export const ALL_TEMPLATES = [TEMPLATE_A1, TEMPLATE_A2, TEMPLATE_B1, TEMPLATE_B2]
