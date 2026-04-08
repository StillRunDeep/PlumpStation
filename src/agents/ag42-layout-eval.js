import { scoreLayout } from '../layout/scorer.js'
import { evaluateTemplate } from '../layout/placer.js'

/**
 * AG4-2: Building Layout Evaluation
 *
 * Receives the raw layout variants from AG4-1, scores each one,
 * and returns them enriched with score, spaceEfficiency, and breakdown,
 * sorted best-first.
 *
 * @param {Array} variants  Raw output of evaluateTemplate() for each template
 * @returns {Array} Scored and sorted variants
 */
export function runAG42(rawVariants) {
  const evaluatedAndScored = rawVariants
    .map(template => evaluateTemplate(template)) // 评估模板（包含门放置和约束检查）
    .map(evaluated => {
      const { score, spaceEfficiency, efficiencyScore, breakdown } = scoreLayout(evaluated);
      return { ...evaluated, score, spaceEfficiency, efficiencyScore, breakdown };
    });

  // 筛选规则：优先保留 violations = 0 的方案，按 score 降序排列
  const feasibleVariants = evaluatedAndScored.filter(v => v.violations.length === 0);
  const unfeasibleVariants = evaluatedAndScored.filter(v => v.violations.length > 0);

  // 对可行方案和不可行方案都按得分降序排列
  feasibleVariants.sort((a, b) => b.score - a.score);
  unfeasibleVariants.sort((a, b) => b.score - a.score);

  const finalVariants = [];
  const targetCount = 9; // 目标方案数量

  // 添加所有可行方案
  finalVariants.push(...feasibleVariants);

  // 如果可行方案不足目标数量，补充得分最高的无效方案
  if (finalVariants.length < targetCount) {
    const needed = targetCount - finalVariants.length;
    finalVariants.push(...unfeasibleVariants.slice(0, needed));
  }

  return finalVariants.sort((a, b) => b.score - a.score); // 最终再次排序确保最高分在前
}
