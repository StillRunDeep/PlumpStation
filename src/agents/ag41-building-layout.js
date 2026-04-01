import { ALL_TEMPLATES } from '../layout/templates.js'
import { evaluateTemplate } from '../layout/placer.js'
import { scoreLayout } from '../layout/scorer.js'

/**
 * AG4-1: Building Space Layout Generator
 *
 * Evaluates the three predefined layout templates against the building
 * constraints, scores each, and returns them ranked best-first.
 *
 * @returns {Array} up to 3 scored layout variants, sorted by score desc
 */
export function runAG41() {
  const variants = ALL_TEMPLATES
    .map(template => {
      const result = evaluateTemplate(template)
      return { ...result, score: scoreLayout(result) }
    })
    .sort((a, b) => b.score - a.score)

  return variants
}
