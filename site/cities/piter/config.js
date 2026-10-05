// Конфиг Петербурга: координаты, окно, мост, тексты интерфейса.

export const CITY = {
  id: 'piter',
  name: 'Санкт-Петербург',
  nameGen: 'Санкт-Петербурга', // «Места Санкт-Петербурга»
  subtitle: 'Нева из окна мансарды',
  radioName: 'Радио Питер',
  windFrom: 'с залива',
  playlist: 'cities/piter/music/playlist.json',
  // пресеты «машины времени»: [ММ-ДД, подпись]
  timePresets: [['06-21', 'белые ночи'], ['10-12', 'осень'], ['01-20', 'зима, лёд']],
  lat: 59.94,
  lon: 30.31,
  utcOffset: 3, // Москва/Санкт-Петербург, без перехода на летнее время
  viewAzimuth: 0, // окно смотрит на север, через Неву на Петропавловку
  fov: 110,

  // Дворцовый мост. График навигации — ориентировочный, сверить с ГМК «Мостотрест»
  // перед каждым сезоном.
  bridge: {
    name: 'Дворцовый',
    season: { from: [4, 15], to: [11, 30] }, // [месяц, день]
    windows: [['01:10', '02:50'], ['03:10', '04:55']],
    moveMinutes: 15, // подъём и опускание пролётов, с плавным разгоном
  },
};

// Время города: Date, у которого UTC-поля = местное время.
export function cityClock(ms) {
  return new Date(ms + CITY.utcOffset * 3600e3);
}

export function hhmm(d) {
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}
