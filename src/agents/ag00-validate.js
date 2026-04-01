import { fmt } from '../utils.js'

export function runAG00(Q, N, S) {
  const errors = []
  const warnings = []

  if (isNaN(Q) || Q <= 0)
    errors.push('总设计流量 Q 必须为正数（m³/h）')

  if (isNaN(N) || !Number.isInteger(N) || N < 1)
    errors.push('工作泵台数 N 必须为正整数')
  else if (N > 6)
    warnings.push(`工作泵台数 N = ${N} 超过 6 台，超出规则 R-OP-02 推荐上限，效率可能下降`)
  else if (N === 1)
    warnings.push('单泵运行可靠性低，建议至少 2 台（R-OP-03）')

  if (isNaN(S) || S <= 0)
    errors.push('集水池占地面积 S 必须为正数（m²）')

  if (errors.length === 0 && !isNaN(Q) && !isNaN(N) && N >= 1) {
    const Qs = Q / N
    if (Qs > 1000)
      warnings.push(`单泵流量 Q_single = ${fmt(Qs)} m³/h 偏大，请确认总流量单位是否正确`)
  }

  return { valid: errors.length === 0, errors, warnings, Q, N, S }
}
