
import { ROOM_DEFS } from './room-defs.js';
import { adjacent } from './placer.js';
import { ADJACENCY_MUST, ADJACENCY_SHOULD } from './adjacency.js';

const DOOR_WIDTH = 900; // 标准门宽

/**
 * 计算两个房间之间的共享墙段。
 * @param {object} p1 第一个房间的放置信息
 * @param {object} p2 第二个房间的放置信息
 * @returns {object|null} 共享墙段信息（x, y, w, d）或 null 如果不相邻
 */
function getSharedWallSegment(p1, p2, tol = 100) {
  if (!p1 || !p2) return null;

  const x1 = p1.x, y1 = p1.y, w1 = p1.w, d1 = p1.d;
  const x2 = p2.x, y2 = p2.y, w2 = p2.w, d2 = p2.d;

  // Check for horizontal adjacency
  if (Math.abs(y1 + d1 - y2) <= tol && Math.max(x1, x2) < Math.min(x1 + w1, x2 + w2)) { // p1 在 p2 上方，共享下方边
    const overlapX = Math.max(x1, x2);
    const overlapW = Math.min(x1 + w1, x2 + w2) - overlapX;
    return { x: overlapX, y: y1 + d1, w: overlapW, d: 0, orientation: 'horizontal' };
  } else if (Math.abs(y2 + d2 - y1) <= tol && Math.max(x1, x2) < Math.min(x1 + w1, x2 + w2)) { // p2 在 p1 上方，共享下方边
    const overlapX = Math.max(x1, x2);
    const overlapW = Math.min(x1 + w1, x2 + w2) - overlapX;
    return { x: overlapX, y: y2 + d2, w: overlapW, d: 0, orientation: 'horizontal' };
  }

  // Check for vertical adjacency
  if (Math.abs(x1 + w1 - x2) <= tol && Math.max(y1, y2) < Math.min(y1 + d1, y2 + d2)) { // p1 在 p2 左方，共享右侧边
    const overlapY = Math.max(y1, y2);
    const overlapD = Math.min(y1 + d1, y2 + d2) - overlapY;
    return { x: x1 + w1, y: overlapY, w: 0, d: overlapD, orientation: 'vertical' };
  } else if (Math.abs(x2 + w2 - x1) <= tol && Math.max(y1, y2) < Math.min(y1 + d1, y2 + d2)) { // p2 在 p1 左方，共享右侧边
    const overlapY = Math.max(y1, y2);
    const overlapD = Math.min(y1 + d1, y2 + d2) - overlapY;
    return { x: x2 + w2, y: overlapY, w: 0, d: overlapD, orientation: 'vertical' };
  }

  return null;
}

/**
 * 计算门的放置位置（共享墙段的 1/4 处，远离房间中心）。
 * @param {object} segment 共享墙段信息
 * @param {object} p1 第一个房间的放置信息
 * @param {object} p2 第二个房间的放置信息
 * @returns {object} 门的放置信息 (x, y, w, d)
 */
function calculateDoorPlacement(segment, p1, p2) {
  let doorX, doorY, doorW, doorD;

  if (segment.w > 0) { // 水平墙段
    const segmentCenter = segment.x + segment.w / 2;
    const p1Center = p1.x + p1.w / 2;
    const p2Center = p2.x + p2.w / 2;

    let placementPos;
    if (Math.abs(segmentCenter - p1Center) > Math.abs(segmentCenter - p2Center)) {
      // 远离 p1 中心
      placementPos = segment.x + segment.w / 4; // 靠近 p2
    } else {
      // 远离 p2 中心
      placementPos = segment.x + segment.w * 3 / 4; // 靠近 p1
    }

    doorX = placementPos - DOOR_WIDTH / 2;
    doorY = segment.y;
    doorW = DOOR_WIDTH;
    doorD = 0; // 假设门是线性的，或者在渲染时处理厚度
  } else { // 垂直墙段
    const segmentCenter = segment.y + segment.d / 2;
    const p1Center = p1.y + p1.d / 2;
    const p2Center = p2.y + p2.d / 2;

    let placementPos;
    if (Math.abs(segmentCenter - p1Center) > Math.abs(segmentCenter - p2Center)) {
      // 远离 p1 中心
      placementPos = segment.y + segment.d / 4; // 靠近 p2
    } else {
      // 远离 p2 中心
      placementPos = segment.y + segment.d * 3 / 4; // 靠近 p1
    }

    doorX = segment.x;
    doorY = placementPos - DOOR_WIDTH / 2;
    doorW = 0;
    doorD = DOOR_WIDTH;
  }

  return { x: doorX, y: doorY, w: doorW, d: doorD };
}

/**
 * 在布局中放置门。
 * @param {object} allPlacements 所有房间的放置信息（ground + level1）
 * @param {object} template 模板信息（包含 buildingW, buildingD）
 * @returns {object[]} 门的放置信息数组
 */
export function placeDoors(allPlacements, template) {
  const doors = [];
  const placedDoorPairs = new Set(); // 记录已放置门的房间对，避免重复

  const roomIds = Object.keys(allPlacements);

  // 1. 处理 MUST 和 SHOULD 邻接关系产生的内门
  const adjacencyRules = [...ADJACENCY_MUST, ...ADJACENCY_SHOULD];
  for (const rule of adjacencyRules) {
    const [id1, id2] = rule.pair;
    const p1 = allPlacements[id1];
    const p2 = allPlacements[id2];

    if (p1 && p2 && !placedDoorPairs.has(`${id1}-${id2}`) && !placedDoorPairs.has(`${id2}-${id1}`)) {
      const segment = getSharedWallSegment(p1, p2);
      if (segment) {
        // 特殊情况：吊装口不设门
        if (ROOM_DEFS[id1].isOpening || ROOM_DEFS[id2].isOpening) {
          continue;
        }

        const door = calculateDoorPlacement(segment, p1, p2);
        doors.push({ ...door, type: 'interior', roomA: id1, roomB: id2 });
        placedDoorPairs.add(`${id1}-${id2}`);
      }
    }
  }

  // 2. 处理房间与走廊 corridor_l1 的连接
  const corridor = allPlacements['corridor_l1'];
  if (corridor) {
    for (const roomId of roomIds) {
      if (roomId === 'corridor_l1') continue;
      const room = allPlacements[roomId];
      const roomDef = ROOM_DEFS[roomId];

      // 一层房间且不是风机房，需要通过走廊进入
      const needsCorridorAccess = roomDef.floor === 'level1' && roomId !== 'fan_room';

      if (needsCorridorAccess && !placedDoorPairs.has(`${roomId}-corridor_l1`) && !placedDoorPairs.has(`corridor_l1-${roomId}`)) {
        const segment = getSharedWallSegment(room, corridor);
        if (segment) {
          // 吊装口不设门
          if (roomDef.isOpening) {
            continue;
          }
          const door = calculateDoorPlacement(segment, room, corridor);
          doors.push({ ...door, type: 'interior', roomA: roomId, roomB: 'corridor_l1' });
          placedDoorPairs.add(`${roomId}-corridor_l1`);
        }
      }
    }
  }

  // 3. 处理 `ext_access` 约束的外门
  for (const roomId of roomIds) {
    const roomDef = ROOM_DEFS[roomId];
    const p = allPlacements[roomId];

    // 仅处理地面层房间且具有 `ext_access` 约束，且不是吊装口
    if (p && roomDef.floor === 'ground' && roomDef.constraints.includes('ext_access') && !roomDef.isOpening) {
      // 一层房间不直接对外墙开门，除了 fan_room，但此处是地面层，所以不冲突

      // 检查是否接触外墙 (非南墙)
      const { buildingW, buildingD } = template;
      const tol = 100; // 容差

      let doorPlaced = false;

      // 西墙
      if (p.x <= tol) {
        const doorY = p.y + (p.d - DOOR_WIDTH) / 2;
        doors.push({ x: 0, y: doorY, w: 0, d: DOOR_WIDTH, type: 'exterior', roomA: roomId, side: 'west' });
        doorPlaced = true;
      }
      // 北墙
      else if (p.y <= tol) {
        const doorX = p.x + (p.w - DOOR_WIDTH) / 2;
        doors.push({ x: doorX, y: 0, w: DOOR_WIDTH, d: 0, type: 'exterior', roomA: roomId, side: 'north' });
        doorPlaced = true;
      }
      // 东墙
      else if (p.x + p.w >= buildingW - tol) {
        const doorY = p.y + (p.d - DOOR_WIDTH) / 2;
        doors.push({ x: buildingW, y: doorY, w: 0, d: DOOR_WIDTH, type: 'exterior', roomA: roomId, side: 'east' });
        doorPlaced = true;
      }

      // 特殊情况：风机房可在北墙/西墙设检修门
      if (roomId === 'fan_room' && roomDef.floor === 'level1') { // 确保是风机房且在一层
        // 假设 fan_room 已经通过 corridor_l1 连接，这里可以额外放置检修门
        // 由于 grower.js 不直接处理外门放置，这里的逻辑可能需要更精细的协调
      }
    }
  }

  return doors;
}
