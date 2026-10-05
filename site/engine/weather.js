// Реальная погода — Open-Meteo, без ключа. Пока нет сети — средняя по сезону и ясно.
let URL = '';
export function configureWeather(lat, lon) {
  URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&wind_speed_unit=ms';
}

const SEASON_TEMP = [-5, -5, 0, 6, 13, 17, 20, 18, 13, 6, 1, -3]; // средняя по месяцам — пока нет сети
export const weather = {
  source: 'default', // 'live' | 'default' | 'manual'
  temp: SEASON_TEMP[new Date().getMonth()], code: 0, cloud: 20, wind: 3, precip: 0,
  kind: 'clear', // clear | cloudy | rain | snow | fog | storm
};

export function kindFromCode(code, cloud) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  return cloud > 70 ? 'cloudy' : 'clear';
}

let liveSnap = null; // последние настоящие данные — вернуть их после ручного режима
export async function refreshWeather() {
  if (weather.source === 'manual' || !URL) return;
  try {
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 10000);
    const r = await fetch(URL, { cache: 'no-store', signal: ac.signal }); clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const c = (await r.json()).current;
    Object.assign(weather, {
      source: 'live', temp: c.temperature_2m, code: c.weather_code, cloud: c.cloud_cover,
      wind: c.wind_speed_10m, precip: c.precipitation,
    });
    weather.kind = kindFromCode(c.weather_code, c.cloud_cover);
    liveSnap = { ...weather };
  } catch (e) {
    console.warn('weather unavailable', e);
  }
}

// Ручной режим для чипа «Погода» и для ?wx= в адресе.
export const WEATHER_KINDS = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'];
export function setManual(kind) {
  if (!kind || !WEATHER_KINDS.includes(kind)) {
    if (weather.source === 'manual') Object.assign(weather, liveSnap || { cloud: 20, precip: 0, kind: 'clear' }, { source: liveSnap ? 'live' : 'default' });
    refreshWeather(); return;
  }
  weather.source = 'manual';
  weather.kind = kind;
  weather.cloud = { clear: 10, cloudy: 90, rain: 95, snow: 90, fog: 100, storm: 100 }[kind];
  weather.precip = { rain: 1.5, storm: 4, snow: 1 }[kind] || 0;
}

export const WEATHER_WORDS = {
  clear: 'ясно', cloudy: 'облачно', rain: 'дождь', snow: 'снег', fog: 'туман', storm: 'гроза',
};
