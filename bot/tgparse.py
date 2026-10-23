"""Разбор публичного превью Telegram-канала (t.me/s/<канал>) и поиск города в тексте поста.

Чистые функции, без сети и Telegram.
  parse_channel_html(html) → [{'id':int, 'ts':<мс UTC>|None, 'text':str, 'geo':{'lat','lon'}|None}] по возрастанию id
  find_city(text, stops, km_now) → остановка из stops.json | None
  find_by_geo(geo, stops, km_now) → остановка | None (если пост с геопозицией)
  is_new_point(stop, cp) → стоит ли предлагать эту точку (отличается от последней)

Всё, что пришло с канала, — недоверенные данные: это только текст для поиска города и для показа владельцу.
"""
import datetime as dt
import math
import re
from html.parser import HTMLParser
from urllib.parse import unquote

CORRIDOR_BACK = 300   # км позади текущей точки
CORRIDOR_FWD = 900    # км впереди
GEO_RADIUS_KM = 40    # геопозиция «у города», если ближе
NEW_POINT_MIN_KM = 20

_WORD = re.compile(r'[a-zа-я0-9]+')
_PREP = {'в', 'во', 'на'}


def norm(s):
    return str(s).lower().replace('ё', 'е')


def words(s):
    """Слова без регистра и ё; дефис и тире — разделители («Улан-Удэ» = «улан удэ»)."""
    return _WORD.findall(norm(s))


# ---------- города ----------
def _stop_forms(stop):
    """Все формы названия как кортежи слов: именительный, родительный, предложный, творительный + винительный на -а/-я."""
    out = set()
    name = stop['name']
    for field in ('name', 'gen', 'loc', 'ins'):
        w = words(stop.get(field, ''))
        if field == 'loc' and w and w[0] in _PREP:
            w = w[1:]
        if w:
            out.add(tuple(w))
    w = words(name)
    if len(w) == 1:  # Читу, Москву, Казань остаётся как есть
        last = w[0]
        if last.endswith('а'):
            out.add((last[:-1] + 'у',))
        elif last.endswith('я'):
            out.add((last[:-1] + 'ю',))
    return out


def build_index(stops):
    """first_word → [(форма, остановка)]; строится один раз на список остановок."""
    idx = {}
    for s in stops:
        for f in _stop_forms(s):
            idx.setdefault(f[0], []).append((f, s))
    return idx


def mentioned_stops(text, stops, index=None):
    """Все остановки, названные в тексте (без фильтра по маршруту)."""
    idx = index or build_index(stops)
    toks = words(text)
    found = {}
    for i, t in enumerate(toks):
        for form, s in idx.get(t, ()):
            if tuple(toks[i:i + len(form)]) == form:
                found[s['km']] = s
    return list(found.values())


def corridor(km_now):
    return (km_now - CORRIDOR_BACK, km_now + CORRIDOR_FWD) if km_now is not None else (-10 ** 9, 10 ** 9)


def find_city(text, stops, km_now):
    """Город из поста, который ожидаем на маршруте: от km_now-300 до km_now+900. Несколько — самый дальний.
    Омонимы и шутки про далёкие города этим коридором отсекаются."""
    lo, hi = corridor(km_now)
    cands = [s for s in mentioned_stops(text, stops) if lo <= s['km'] <= hi]
    return max(cands, key=lambda s: s['km']) if cands else None


def is_new_point(stop, cp):
    """Предлагаем точку, только если она отличается от последней (по названию и километру)."""
    if not stop:
        return False
    if not cp:
        return True
    if norm(cp.get('label', '')) == norm(stop['name']):
        return False
    return abs(cp['km'] - stop['km']) >= NEW_POINT_MIN_KM


def same_as_offered(stop, last_offer, now_ms, ttl_ms=48 * 3600 * 1000):
    """Этот город уже предлагали владельцу (из любого источника) недавно: last_offer = {'name','ts'} | None."""
    if not stop or not isinstance(last_offer, dict):
        return False
    return norm(last_offer.get('name', '')) == norm(stop['name']) and now_ms - int(last_offer.get('ts', 0)) < ttl_ms


# ---------- геопозиция ----------
def _hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def find_by_geo(geo, stops, km_now):
    """Ближайшая остановка к координатам, если ближе GEO_RADIUS_KM и она в коридоре маршрута."""
    if not geo:
        return None
    lo, hi = corridor(km_now)
    best = None
    for s in stops:
        if not lo <= s['km'] <= hi or 'lat' not in s:
            continue
        d = _hav(geo['lat'], geo['lon'], s['lat'], s['lon'])
        if d <= GEO_RADIUS_KM and (best is None or d < best[0]):
            best = (d, s)
    return best[1] if best else None


_NUM = r'(-?\d{1,3}\.\d+)'
_GEO_PATTERNS = [
    re.compile(r'[?&](?:q|query|ll|pt|center|daddr|destination)=' + _NUM + r'[,;]\s*' + _NUM),
    re.compile(r'@' + _NUM + r',' + _NUM),
    re.compile(r'^geo:' + _NUM + r',' + _NUM),
    re.compile(r'[?&]whatshere\[point\]=' + _NUM + r',' + _NUM),
]
_MAP_HOST = re.compile(r'(maps\.google|google\.[a-z.]+/maps|goo\.gl/maps|maps\.app\.goo\.gl|yandex\.[a-z]+/maps|2gis\.|openstreetmap\.org|maps\.apple|^geo:)', re.I)
_TEXT_COORDS = re.compile(r'(?<![\d.])(\d{2}\.\d{3,6})\s*[,;]\s*(\d{2,3}\.\d{3,6})(?![\d.])')


def _ok(lat, lon):
    return 40 <= lat <= 72 and 25 <= lon <= 180


def extract_geo(hrefs, text=''):
    """Координаты из ссылок на карты (Google, Яндекс, OSM, geo:) или явной пары «43.1155, 131.8855» в тексте."""
    for h in hrefs:
        h = unquote(h)
        if not _MAP_HOST.search(h):
            continue
        for rx in _GEO_PATTERNS:
            m = rx.search(h)
            if m:
                a, b = float(m.group(1)), float(m.group(2))
                lat, lon = (b, a) if re.search(r'yandex|whatshere', h, re.I) else (a, b)  # Яндекс пишет «долгота,широта»
                if _ok(lat, lon):
                    return {'lat': lat, 'lon': lon}
    m = _TEXT_COORDS.search(text or '')
    if m and _ok(float(m.group(1)), float(m.group(2))):
        return {'lat': float(m.group(1)), 'lon': float(m.group(2))}
    return None


# ---------- HTML превью ----------
class _Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.msgs = []
        self.cur = None
        self.depth = 0       # глубина div внутри блока текста; 0 — вне текста
        self.text_done = False

    def _flush(self):
        if self.cur:
            self.msgs.append(self.cur)
        self.cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'div' and 'tgme_widget_message' in cls and a.get('data-post'):
            self._flush()
            self.cur = {'post': a['data-post'], 'ts': None, 'parts': [], 'hrefs': []}
            self.depth, self.text_done = 0, False
            return
        if not self.cur:
            return
        if self.depth:
            if tag == 'div':
                self.depth += 1
            elif tag == 'br':
                self.cur['parts'].append('\n')
        elif tag == 'div' and 'js-message_text' in cls and not self.text_done:
            self.depth, self.text_done = 1, True
        if tag == 'time' and a.get('datetime') and self.cur['ts'] is None:
            try:
                t = dt.datetime.fromisoformat(a['datetime'])
                if t.tzinfo is None:
                    t = t.replace(tzinfo=dt.timezone.utc)
                self.cur['ts'] = int(t.timestamp() * 1000)
            except ValueError:
                pass
        if tag == 'a' and a.get('href'):
            self.cur['hrefs'].append(a['href'])

    def handle_endtag(self, tag):
        if tag == 'div' and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.cur and self.depth:
            self.cur['parts'].append(data)

    def close(self):
        super().close()
        self._flush()


def _clean(parts):
    s = ''.join(parts).replace('\xa0', ' ')
    lines = [' '.join(l.split()) for l in s.split('\n')]
    return '\n'.join(l for l in lines if l).strip()


def parse_channel_html(html):
    p = _Page()
    p.feed(html or '')
    p.close()
    out = []
    for m in p.msgs:
        mt = re.fullmatch(r'.+/(\d+)', m['post'])
        if not mt:
            continue
        text = _clean(m['parts'])
        out.append({'id': int(mt.group(1)), 'ts': m['ts'], 'text': text, 'geo': extract_geo(m['hrefs'], text)})
    out.sort(key=lambda x: x['id'])
    return out


def preview(text, n=120):
    """Первые n символов для сообщения владельцу, одной строкой."""
    s = ' '.join(str(text).split())
    return s if len(s) <= n else s[:n].rstrip() + '…'
