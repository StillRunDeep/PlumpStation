import { generateTemplateA } from '../layout/grower.js'
import { getDefaultUserParams, getUserConfirmedParams } from '../layout/user-params.js'

/**
 * AG4-1: Building Space Layout Generator
 *
 * Generates 9 Template A variants at the user-specified building dimensions.
 * Each variant is produced by the seed-position-growth algorithm in grower.js
 * with an independent RNG seed; the resulting room sizes emerge from random
 * initial positions and may differ from any user-supplied area targets.
 *
 * Scoring and ranking is handled by AG4-2 (ag42-layout-eval.js).
 *
 * @returns {Promise<Array>} 9 unsorted layout variants
 */
export async function runAG41() {
  const userParams = await getUserConfirmedParams(getDefaultUserParams())

  // 9 variants with well-spaced seeds (Fibonacci / Knuth hashing ensures
  // neighbouring indices produce uncorrelated RNG states)
  const baseSeed = Date.now()
  const variants = Array.from({ length: 9 }, (_, i) => {
    const seed = (baseSeed ^ (i * 2654435761)) >>> 0
    return generateTemplateA(seed, userParams.buildingW, userParams.buildingD, userParams.roomAreas || {})
  })

  return variants
}
