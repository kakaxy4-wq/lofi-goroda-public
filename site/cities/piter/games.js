// Мини-игры Петербурга: монетка Чижику-Пыжику на Фонтанке и Зайцу у Иоанновского моста.

export const TARGETS = {
  chizhik: {
    title: 'Монетка для Чижика-Пыжика', ledge: [71, 16], y: 52, // зона попадания чуть шире постамента: монета отскакивает внутрь
    draw(g, t) {
      // гранитная стена Фонтанки
      g.fillStyle = '#2a2f3c'; g.fillRect(0, 0, 160, 100);
      for (let y = 0; y < 70; y += 6) for (let x = (y / 6) % 2 * 8; x < 160; x += 16) { g.fillStyle = '#394050'; g.fillRect(x, y, 15, 5); g.fillStyle = '#434b5c'; g.fillRect(x, y, 15, 1); }
      // постамент-уступ
      g.fillStyle = '#5a6272'; g.fillRect(72, 52, 14, 4); g.fillStyle = '#707a8c'; g.fillRect(72, 52, 14, 1); g.fillStyle = '#4a5160'; g.fillRect(74, 56, 10, 3);
      // чижик
      g.fillStyle = '#c89a3a'; g.fillRect(77, 47, 5, 4); g.fillRect(81, 46, 2, 2); g.fillStyle = '#e8c060'; g.fillRect(78, 47, 2, 1);
      g.fillStyle = '#2a1a0a'; g.fillRect(82, 46, 1, 1); g.fillStyle = '#a07828'; g.fillRect(75, 48, 2, 2); g.fillRect(83, 47, 1, 1);
      g.fillStyle = '#8a6a2a'; g.fillRect(78, 51, 1, 1); g.fillRect(80, 51, 1, 1);
      water(g, t, 70);
    },
  },
  zayats: {
    title: 'Монетка для Зайца', ledge: [73, 14], y: 50,
    draw(g, t) {
      g.fillStyle = '#1e2436'; g.fillRect(0, 0, 160, 100);
      g.fillStyle = '#3a3440'; g.fillRect(0, 20, 160, 6); // Иоанновский мост
      for (let x = 4; x < 160; x += 10) { g.fillStyle = '#4a4250'; g.fillRect(x, 26, 2, 44); }
      g.fillStyle = '#5a4a3a'; g.fillRect(74, 54, 12, 20); g.fillStyle = '#6e5c48'; g.fillRect(74, 54, 12, 2); // свая
      g.fillStyle = '#9a8a70'; g.fillRect(77, 44, 6, 8); g.fillRect(78, 38, 2, 7); g.fillRect(81, 38, 2, 7); g.fillStyle = '#b8a88c'; g.fillRect(78, 46, 3, 3);
      g.fillStyle = '#1a1208'; g.fillRect(78, 45, 1, 1);
      water(g, t, 70);
    },
  },
};

function water(g, t, top) {
  g.fillStyle = '#16202e'; g.fillRect(0, top, 160, 30);
  g.fillStyle = '#2c3e56';
  for (let i = 0; i < 24; i++) g.fillRect(((i * 37 + t * 8) % 170) - 5, top + 3 + (i * 7) % 26, 4 + (i % 4), 1);
}
