
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
    roomTargetAreas: {
      trafo1: 20,
      trafo2: 20,
      parking: 80,
      repair_zone: 60,
      meter_main: 12,
      meter_sub: 8,
      fire_equip: 15,
      lv_control: 65,
      fan_room: 55,
      clean_pump: 25,
      rainwater: 25,
      corridor_l1: 18,
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

  // 这里可以添加逻辑来展示提示规则
  console.log("模拟用户交互：展示 A.0 中的所有可调参数及其初始值。");
  console.log("对继承自上游模块的参数给出提示（此处未实现具体继承逻辑）。");
  console.log("等待用户确认或修改，锁定 L、W 及各房间目标面积。");

  return { buildingW: Math.round(bW / 100) * 100, buildingD: Math.round(bD / 100) * 100, roomTargetAreas: roomAreas };
}
