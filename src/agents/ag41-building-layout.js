import { generateConstrainedLayout } from '../layout/layout-generator.js'
import { getDefaultUserParams, getUserConfirmedParams } from '../layout/user-params.js'

/**
 * AG4-1: Building Space Layout Generator
 *
 * Scoring and ranking is handled by AG4-2 (ag42-layout-eval.js).
 *
 * @returns {Promise<Array>} unsorted layout variants
 */
export async function runAG41() {
  // 1. 获取默认用户参数
  const defaultUserParams = getDefaultUserParams();

  // 2. 模拟用户交互，获取用户确认或修改后的参数
  // 在实际应用中，这里会调用 UI 界面来收集用户输入
  const userParams = await getUserConfirmedParams(defaultUserParams);

  const variants = [];
  // 生成 9 个方案
  for (let i = 0; i < 9; i++) {
    // 使用当前时间戳和循环索引作为种子，确保每次生成都不同
    const seed = Math.floor(Math.random() * 100000) + i;
    const t = generateConstrainedLayout(seed, userParams.buildingW, userParams.buildingD, userParams.roomTargetAreas, 'S', i + 1);
    variants.push(t);
  }

  // AG4-1 只需要返回原始的模板对象，评估和筛选由 AG4-2 处理
  return variants;
}
