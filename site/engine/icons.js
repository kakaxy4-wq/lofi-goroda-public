// Пиксельные иконки 9×9: 'X' — пиксель. Рисуются как SVG, цвет — currentColor.
const I = {
  play: ['.X.......', '.XX......', '.XXX.....', '.XXXX....', '.XXXXX...', '.XXXX....', '.XXX.....', '.XX......', '.X.......'],
  pause: ['.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..', '.XX..XX..'],
  lamp: ['..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '....X....', '....X....', '....X....', '....X....', '..XXXXX..', '.XXXXXXX.'],
  garland: ['X.......X', '.X.....X.', '..XX.XX..', '....X....', '.X..X..X.', '.X..X..X.', '.X.....X.', '.........', '.........'],
  rain: ['..XXXX...', '.XXXXXX..', 'XXXXXXXX.', '.........', '.X..X..X.', 'X..X..X..', '.........', '..X..X..X', '.X..X..X.'],
  timer: ['XXXXXXXXX', '.X.....X.', '..X...X..', '...XXX...', '....X....', '...X.X...', '..X.X.X..', '.XXXXXXX.', 'XXXXXXXXX'],
  sound: ['...X.....', '..XX..X..', 'XXXX...X.', 'XXXX.X.X.', 'XXXX.X.X.', 'XXXX...X.', '..XX..X..', '...X.....', '.........'],
  pin: ['..XXXXX..', '.XX...XX.', '.X..X..X.', '.XX...XX.', '..XX.XX..', '...XXX...', '....X....', '.........', '.........'],
  clock: ['..XXXXX..', '.X.....X.', 'X...X...X', 'X...X...X', 'X...XXX.X', 'X.......X', '.X.....X.', '..XXXXX..', '.........'],
  full: ['XXX...XXX', 'X.......X', 'X.......X', '.........', '.........', '.........', 'X.......X', 'X.......X', 'XXX...XXX'],
  help: ['..XXXX...', '.X....X..', '......X..', '....XX...', '...X.....', '...X.....', '.........', '...X.....', '.........'],
  note: ['...XXXXX.', '...X...X.', '...X...X.', '...X...X.', '...X...X.', '.XXX.XXX.', 'XXXX.XXXX', '.XX...XX.', '.........'],
  heart: ['.........', '.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'],
  star: ['....X....', '....X....', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '..XX.XX..', '.XX...XX.', '.X.....X.'],
  moon: ['...XXX...', '..XX.....', '.XX......', '.XX......', '.XX......', '.XX......', '..XX.....', '...XXX...', '.........'],
  share: ['....X....', '...XXX...', '..X.X.X..', '....X....', '....X....', 'X...X...X', 'X.......X', 'X.......X', 'XXXXXXXXX'],
  city: ['....X....', '....X....', '...XXX...', '.X.XXX.X.', '.X.X.X.X.', 'XXXXXXXXX', 'X.X.X.X.X', 'XXXXXXXXX', '.........'],
};

export function icon(name) {
  const rows = I[name];
  let rects = '';
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'X') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
  return `<svg viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon) + (el.dataset.label ? `<span>${el.dataset.label}</span>` : ''); });
}
