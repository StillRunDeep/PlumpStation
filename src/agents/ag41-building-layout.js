import { ALL_TEMPLATES } from '../layout/templates.js'
import { evaluateTemplate } from '../layout/placer.js'

/**
 * AG4-1: Building Space Layout Generator
 *
 * Evaluates all predefined layout templates against building constraints.
 * Returns raw results (placements, violations, adjacency) without scoring.
 * Scoring and ranking is handled by AG4-2 (ag42-layout-eval.js).
 *
 * @returns {Array} unsorted layout variants
 */
export function runAG41() {
  return ALL_TEMPLATES.map(template => evaluateTemplate(template))
}
