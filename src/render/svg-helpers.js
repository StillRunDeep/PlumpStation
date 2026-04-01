// SVG string-building helpers (coordinate-system agnostic)

export function _r(x, y, w, h, fill, stroke, sw = 1, extra = '') {
  return `<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`
}

export function _l(x1, y1, x2, y2, stroke, sw = 1, dash = '') {
  return `<line x1="${(+x1).toFixed(1)}" y1="${(+y1).toFixed(1)}" x2="${(+x2).toFixed(1)}" y2="${(+y2).toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

export function _t(x, y, txt, sz, fill, anchor = 'middle', weight = 'normal') {
  return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${sz}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family="Microsoft YaHei,sans-serif">${txt}</text>`
}

export function _poly(pts, fill) {
  return `<polygon points="${pts}" fill="${fill}"/>`
}

// Horizontal dimension line with arrows and label
export function _dh(x1, x2, y, label, clr) {
  const tk = 8, as = 6
  x1 = +x1; x2 = +x2; y = +y
  const mid = (x1 + x2) / 2
  return [
    _l(x1, y - tk, x1, y + tk, clr),
    _l(x2, y - tk, x2, y + tk, clr),
    _l(x1, y, x2, y, clr),
    _poly(`${x1},${y} ${x1 + as},${y - as / 2} ${x1 + as},${y + as / 2}`, clr),
    _poly(`${x2},${y} ${x2 - as},${y - as / 2} ${x2 - as},${y + as / 2}`, clr),
    _t(mid, y - 6, label, 11, clr),
  ].join('')
}

// Vertical dimension line with arrows and label
export function _dv(x, y1, y2, label, clr) {
  const tk = 8, as = 6
  x = +x; y1 = +y1; y2 = +y2
  const mid = (y1 + y2) / 2, lx = x + 20
  return [
    _l(x - tk, y1, x + tk, y1, clr),
    _l(x - tk, y2, x + tk, y2, clr),
    _l(x, y1, x, y2, clr),
    _poly(`${x},${y1} ${x - as / 2},${y1 + as} ${x + as / 2},${y1 + as}`, clr),
    _poly(`${x},${y2} ${x - as / 2},${y2 - as} ${x + as / 2},${y2 - as}`, clr),
    `<text transform="translate(${lx.toFixed(1)},${mid.toFixed(1)}) rotate(-90)" font-size="11" fill="${clr}" text-anchor="middle" font-family="Microsoft YaHei,sans-serif">${label}</text>`,
  ].join('')
}
