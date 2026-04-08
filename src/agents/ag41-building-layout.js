import { TEMPLATE_B1, TEMPLATE_B2 } from '../layout/templates.js'
import { evaluateTemplate } from '../layout/placer.js'
import { generateTemplateAVariants } from '../layout/grower.js'

/**
 * AG4-1: Building Space Layout Generator
 *
 * Scoring and ranking is handled by AG4-2 (ag42-layout-eval.js).
 *
 * @param {object} [userParams]
 * @param {number} [userParams.buildingW=18600]  User-specified building width (mm)
 * @param {number} [userParams.buildingD=24000]  User-specified building depth (mm)
 * @param {object} [userParams.roomAreas={}]     Target room areas (m²), keyed by room ID
 * @returns {Array} unsorted layout variants
 */
export function runAG41(userParams = {}) {
  const aVariants = generateTemplateAVariants(userParams)
  const bVariants = [TEMPLATE_B1, TEMPLATE_B2].map(t => evaluateTemplate(t))
  return [...aVariants, ...bVariants]
}
