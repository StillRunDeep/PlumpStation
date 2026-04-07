
/**
 * @file 用户交互参数收集与继承提示逻辑
 * @description 根据 AG4-1 模板A 的用户交互参数，实现参数收集和继承提示机制。
 */

/**
 * 定义用户交互参数的接口
 * @typedef {object} UserParams
 * @property {number} buildingW - 用户确认的建筑宽度 W（mm），默认 18600
 * @property {number} buildingD - 用户确认的建筑深度 D（mm），默认 24000
 * @property {object} roomTargetAreas - 各功能空间目标面积（m²），用户可修改
 * @property {number} roomTargetAreas.trafo1 - 默认 20
 * @property {number} roomTargetAreas.trafo2 - 默认 20
 * @property {number} roomTargetAreas.parking - 默认 80，独立功能空间参与生长
 * @property {number} roomTargetAreas.repair_zone - 默认 60
 * @property {number} roomTargetAreas.meter_main - 默认 12
 * @property {number} roomTargetAreas.meter_sub - 默认 8
 * @property {number} roomTargetAreas.fire_equip - 默认 15
 * @property {number} roomTargetAreas.lv_control - 默认 65
 * @property {number} roomTargetAreas.fan_room - 55
 * @property {number} roomTargetAreas.clean_pump - 默认 25
 * @property {number} roomTargetAreas.rainwater - 默认 25
 * @property {number} roomTargetAreas.corridor_l1 - 默认 18
 */

/**
 * 获取默认用户参数
 * @returns {UserParams} 默认用户参数
 */
/**
 * 获取默认用户参数
 * @returns {UserParams} 默认用户参数
 */
export function getDefaultUserParams() {
  return {
    buildingW: 18600,
    buildingD: 24000,
    // Default areas reflect actual proportional dimensions of the reference building.
    // Only lv_control, clean_pump, parking, repair_zone, fan_room, rainwater
    // are actively used by the layout generator; others are informational.
    roomAreas: {
      trafo1:       69,   // 8600 × 8000 ≈ 69 m² (proportional, not user-adjustable)
      trafo2:       69,
      parking:      172,  // 10000 × 17200 ≈ 172 m²
      repair_zone:  34,   // 10000 × 3400  ≈ 34 m²
      meter_main:   10,   // 2800 × 3400 ≈ 10 m²
      meter_sub:    9,    // 2800 × 3300 ≈  9 m²
      fire_equip:   7,    // 2800 × 2500 ≈  7 m²
      lv_control:   141,  // 8500 × 17500 ≈ 141 m²
      fan_room:     160,  // 13600 × 11800 ≈ 160 m²
      clean_pump:   40,   // 6500 × 6100 ≈ 40 m²
      rainwater:    57,   // 8500 × 6700 ≈ 57 m²
      corridor_l1:  20,   // 1600 × 12200 ≈ 20 m²
    },
  };
}

/**
 * Read optional numeric input from a DOM element. Returns null if empty or invalid.
 * @param {string} id The ID of the input element
 * @returns {number|null} The parsed number or null
 */
function readOptional(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) || v <= 0 ? null : v;
}

/**
 * 从 UI 收集 AG4-1 用户参数。
 * @returns {UserParams} 用户确认或修改后的参数
 */
export async function getUserConfirmedParams() {
  const bW = parseFloat(document.getElementById('inp-bw')?.value) || 18600;
  const bD = parseFloat(document.getElementById('inp-bd')?.value) || 24000;

  const roomAreas = {};

  // Rooms whose area inputs actively influence the layout generator
  const raRepair  = readOptional('ra-repair');
  const raParking = readOptional('ra-parking');
  const raLv      = readOptional('ra-lv');
  const raCp      = readOptional('ra-cp');
  const raFan     = readOptional('ra-fan');
  const raRw      = readOptional('ra-rw');

  if (raRepair  !== null) roomAreas.repair_zone = raRepair;
  if (raParking !== null) roomAreas.parking     = raParking;
  if (raLv      !== null) roomAreas.lv_control  = raLv;
  if (raCp      !== null) roomAreas.clean_pump  = raCp;
  if (raFan     !== null) roomAreas.fan_room    = raFan;
  if (raRw      !== null) roomAreas.rainwater   = raRw;

  return { buildingW: Math.round(bW / 100) * 100, buildingD: Math.round(bD / 100) * 100, roomAreas };
}
