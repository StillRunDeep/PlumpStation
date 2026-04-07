/**
 * AG0-1: 连接关系配置器 — 纯数据模型
 * 无 DOM 依赖，可在 Worker 或 SSR 环境中运行
 */

// 画布尺寸（editor 参考坐标系）
const CANVAS_W = 800
const CANVAS_H = 400

// 房间定义
const ROOMS = [
  { id: 'wet_well',   label: '集水坑',     editorX: 20,  editorY: 40, editorW: 170, editorH: 320 },
  { id: 'pump_room',  label: '泵房维护间', editorX: 210, editorY: 40, editorW: 560, editorH: 320 },
]

// 虚拟源/汇节点（不可删除、不可拖动）
const FIXED_NODES = [
  { id: 'source',    type: 'source',    label: '进水', roomId: 'wet_well',  editorX: 60,  editorY: 200, fixed: true },
  { id: 'discharge', type: 'discharge', label: '出水', roomId: null,        editorX: 775, editorY: 200, fixed: true },
]

let _idCounter = 1
function uid(prefix) { return `${prefix}_${_idCounter++}` }

/**
 * 生成默认拓扑（N 台工作泵 + 1 台备用泵）
 * @param {number} N 工作泵数量
 * @returns {Topology}
 */
export function generateDefaultTopology(N) {
  _idCounter = 1
  const devices = []
  const edges   = []
  const total   = N + 1  // +1 备用

  // 每条分支的水平间距
  const branchX0  = 240   // 第一台泵的 X 起点
  const branchDX  = Math.min(90, (CANVAS_W - 100 - branchX0) / total)
  const pumpY     = 200   // 泵的 Y 坐标（居中）
  const cvOffset  = -60   // 止回阀相对于泵的 Y 偏移（往上）
  const gvOffset  = -110  // 电动闸阀相对于泵的 Y 偏移

  for (let i = 0; i < total; i++) {
    const isSpare = i === total - 1
    const bx = branchX0 + i * branchDX

    const pumpId = uid('pump')
    const cvId   = uid('cv')
    const gvId   = uid('gv')

    devices.push({
      id:      pumpId,
      type:    'pump',
      label:   isSpare ? '备' : `P${i + 1}`,
      roomId:  'pump_room',
      editorX: bx,
      editorY: pumpY,
      isSpare,
    })
    devices.push({
      id:      cvId,
      type:    'check_valve',
      label:   isSpare ? '止备' : `止${i + 1}`,
      roomId:  'pump_room',
      editorX: bx,
      editorY: pumpY + cvOffset,
      isSpare,
    })
    devices.push({
      id:      gvId,
      type:    'gate_valve',
      label:   isSpare ? '闸备' : `闸${i + 1}`,
      roomId:  'pump_room',
      editorX: bx,
      editorY: pumpY + gvOffset,
      isSpare,
    })

    // source → pump → check_valve → gate_valve → discharge
    edges.push({ id: uid('e'), fromId: 'source', toId: pumpId })
    edges.push({ id: uid('e'), fromId: pumpId,   toId: cvId })
    edges.push({ id: uid('e'), fromId: cvId,     toId: gvId })
    edges.push({ id: uid('e'), fromId: gvId,     toId: 'discharge' })
  }

  return {
    rooms:   ROOMS.map(r => ({ ...r })),
    devices,
    edges,
  }
}

/**
 * 深拷贝拓扑
 */
export function cloneTopology(t) {
  return JSON.parse(JSON.stringify(t))
}

/**
 * 向拓扑中添加设备（不可变，返回新拓扑）
 */
export function addDevice(topology, type, roomId) {
  const room = topology.rooms.find(r => r.id === roomId) || topology.rooms[1]
  // 在房间中心附近放置，避免堆叠
  const existingInRoom = topology.devices.filter(d => d.roomId === roomId)
  const offsetX = (existingInRoom.length % 5) * 50
  const offsetY = Math.floor(existingInRoom.length / 5) * 60

  const labels = { pump: 'P', check_valve: '止', gate_valve: '闸' }
  const newId = uid(type)
  const newDevice = {
    id:      newId,
    type,
    label:   labels[type] + newId.split('_').pop(),
    roomId,
    editorX: room.editorX + 40 + offsetX,
    editorY: room.editorY + 80 + offsetY,
    isSpare: false,
  }
  return { ...topology, devices: [...topology.devices, newDevice] }
}

/**
 * 从拓扑中删除设备（同时删除关联边）
 */
export function removeDevice(topology, deviceId) {
  return {
    ...topology,
    devices: topology.devices.filter(d => d.id !== deviceId),
    edges:   topology.edges.filter(e => e.fromId !== deviceId && e.toId !== deviceId),
  }
}

/**
 * 更新设备的房间归属
 */
export function moveDeviceToRoom(topology, deviceId, roomId) {
  return {
    ...topology,
    devices: topology.devices.map(d =>
      d.id === deviceId ? { ...d, roomId } : d
    ),
  }
}

/**
 * 更新设备坐标
 */
export function moveDevice(topology, deviceId, x, y) {
  return {
    ...topology,
    devices: topology.devices.map(d =>
      d.id === deviceId ? { ...d, editorX: x, editorY: y } : d
    ),
  }
}

/**
 * 添加边（fromId → toId 不存在时才添加）
 */
export function addEdge(topology, fromId, toId) {
  const already = topology.edges.some(e => e.fromId === fromId && e.toId === toId)
  if (already) return topology
  return {
    ...topology,
    edges: [...topology.edges, { id: uid('e'), fromId, toId }],
  }
}

/**
 * 删除边
 */
export function removeEdge(topology, edgeId) {
  return { ...topology, edges: topology.edges.filter(e => e.id !== edgeId) }
}

/**
 * 将拓扑转换为 AG3-1 所需参数
 */
export function topologyToAG31Params(topology) {
  const allNodes = [...FIXED_NODES, ...topology.devices]
  const pumps      = topology.devices.filter(d => d.type === 'pump')
  const checkValves = topology.devices.filter(d => d.type === 'check_valve')
  const gateValves  = topology.devices.filter(d => d.type === 'gate_valve')

  const devicesByRoom = {}
  for (const room of topology.rooms) {
    devicesByRoom[room.id] = topology.devices.filter(d => d.roomId === room.id)
  }

  // 按 editorX 排序（左→右 = 布局顺序）
  const pumpsInOrder = [...pumps].sort((a, b) => a.editorX - b.editorX)

  return { pumpsInOrder, checkValves, gateValves, devicesByRoom, allNodes, edges: topology.edges }
}

/** 导出固定节点供 editor 使用 */
export { FIXED_NODES, ROOMS }
