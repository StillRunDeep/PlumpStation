import { scoreLayout } from '../layout/scorer.js'

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
export function runAG42(variants) {
  return variants
    .map(variant => {
      const { score, spaceEfficiency, efficiencyScore, breakdown } = scoreLayout(variant)
      return { ...variant, score, spaceEfficiency, efficiencyScore, breakdown }
    })
    .sort((a, b) => b.score - a.score)
}
