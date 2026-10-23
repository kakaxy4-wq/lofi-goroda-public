"""Команда /road: разбор аргументов и тексты ответов. Чистые функции, без Telegram и сети.

stops — список остановок из site/cities/doroga/stops.json:
  [{"km":0,"name":"Владивосток","gen":"Владивостока","loc":"во Владивостоке","big":true,...}, ...]
parse_road(args, stops) → одно из действий:
  {'op':'state'}
  {'op':'cp','km':2925,'label':'Чита'}
  {'op':'status','status':'run|pause|done|soon'}
  {'op':'undo'}
  {'op':'start','ts':<мс>}
  {'op':'error','text':'...'}
"""
import datetime as dt
import re

ROAD_URL = 'https://lofi-goroda.ru/doroga/'
KM_MAX = 9280
VLAD = dt.timezone(dt.timedelta(hours=10))  # старт задаётся по Владивостоку
STALE_HOURS = 20
MIN_PREFIX = 3  # короче три буквы по началу слова не ищем: «ч» — это не город

STATUS_WORDS = {
    'пауза': 'pause', 'паузу': 'pause', 'стоп': 'pause', 'pause': 'pause', 'stop': 'pause',
    'едем': 'run', 'поехали': 'run', 'run': 'run', 'go': 'run',
    'финиш': 'done', 'приехали': 'done', 'done': 'done', 'finish': 'done',
    'ждем': 'soon', 'soon': 'soon',
}
UNDO_WORDS = {'отмена', 'отменить', 'undo', 'назад'}
START_WORDS = {'старт', 'start'}
PREPOSITIONS = {'в', 'во', 'у', 'около', 'возле', 'под', 'за', 'на', 'до', 'из'}
STATUS_RU = {'soon': 'ждём старта', 'run': 'в пути', 'pause': 'на паузе', 'done': 'доехали'}

# творительный падеж нужен для «между Читой и Улан-Удэ»; в stops.json есть только name/gen/loc
INS_SPECIAL = {'Нижний Новгород': 'Нижним Новгородом', 'Улан-Удэ': 'Улан-Удэ', 'Сковородино': 'Сковородино'}


def norm(s):
    return ' '.join(str(s).lower().replace('ё', 'е').split())


def ins(stop):
    """Город в творительном падеже: поле ins, иначе таблица исключений, иначе по окончанию."""
    if stop.get('ins'):
        return stop['ins']
    n = stop['name']
    if n in INS_SPECIAL:
        return INS_SPECIAL[n]
    if n.endswith('а'):
        return n[:-1] + 'ой'
    if n.endswith('я'):
        return n[:-1] + 'ей'
    if n.endswith('ь'):
        return n[:-1] + 'ью'
    if n[-1] in 'оеиуэю':
        return n
    return n + 'ом'


def _forms(stop):
    out = {norm(stop['name']), norm(stop.get('gen', '')), norm(stop.get('loc', ''))}
    loc = norm(stop.get('loc', '')).split(' ', 1)
    if len(loc) == 2:
        out.add(loc[1])  # «в чите» → «чите»
    out.discard('')
    return out


def find_stop(q, stops):
    """Город по name/gen/loc без регистра и ё; точное совпадение важнее начала слова.
    → (stop | None, список неоднозначных кандидатов)."""
    q = norm(q)
    words = q.split(' ')
    cands = {q}
    while words and words[0] in PREPOSITIONS:
        words = words[1:]
        if words:
            cands.add(' '.join(words))
    exact = [s for s in stops if _forms(s) & cands]
    if exact:
        return exact[0], []
    pref = [s for s in stops if any(len(c) >= MIN_PREFIX and f.startswith(c) for c in cands for f in _forms(s))]
    if len(pref) == 1:
        return pref[0], []
    return None, pref


def nearest(km, stops):
    return min(stops, key=lambda s: abs(s['km'] - km))


def round10(km):
    return min(KM_MAX, int(km / 10 + 0.5) * 10)


def parse_start(text, now=None):
    """«19.10 08:00» | «19.10.2026 08:00» | «19.10» (тогда 08:00) — время Владивостока → мс UTC; None при ошибке."""
    m = re.fullmatch(r'(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?:\s+(\d{1,2})[:.](\d{2}))?', text.strip())
    if not m:
        return None
    d, mo, y, h, mi = m.groups()
    y = int(y) if y else (now or dt.datetime.now(dt.timezone.utc)).year
    try:
        t = dt.datetime(y, int(mo), int(d), int(h or 8), int(mi or 0), tzinfo=VLAD)
    except ValueError:
        return None
    return int(t.timestamp() * 1000)


def parse_road(args, stops, now=None):
    text = (args or '').strip()
    if not text:
        return {'op': 'state'}
    low = norm(text)
    first, _, rest = low.partition(' ')
    if low in STATUS_WORDS:
        return {'op': 'status', 'status': STATUS_WORDS[low]}
    if low in UNDO_WORDS:
        return {'op': 'undo'}
    if first in START_WORDS:
        ts = parse_start(rest, now) if rest else None
        if ts is None:
            return {'op': 'error', 'text': 'Старт так: /road старт 19.10 08:00 (время Владивостока)'}
        return {'op': 'start', 'ts': ts}
    # число: километр от Владивостока
    nums = re.sub(r'\s*км\.?$', '', low).replace(' ', '')
    if re.fullmatch(r'\d{1,5}', nums):
        km = int(nums)
        if km > KM_MAX:
            return {'op': 'error', 'text': f'Километр от 0 до {KM_MAX}. Владивосток — 0, Москва — {KM_MAX}.'}
        return {'op': 'cp', 'km': km, 'label': ('около ' + nearest(km, stops)['gen'])[:40]}
    # город [+/-сдвиг]
    shift, city_q = 0, text
    m = re.fullmatch(r'(.+?)\s*([+\-−–])\s*(\d{1,4})\s*(?:км\.?)?', text)
    if m:
        city_q = m.group(1)
        shift = int(m.group(3)) * (1 if m.group(2) == '+' else -1)
    stop, amb = find_stop(city_q, stops)
    if not stop:
        if amb:
            return {'op': 'error', 'text': 'Уточните город: ' + ', '.join(s['name'] for s in amb[:6])}
        return {'op': 'error', 'text': (f'Не понял «{text}». Примеры: /road Чита · /road 6200 · /road Чита +120 · '
                                        '/road пауза · /road едем · /road финиш · /road отмена · /road старт 19.10 08:00')}
    km = stop['km'] + shift
    if not 0 <= km <= KM_MAX:
        return {'op': 'error', 'text': f'Получился километр {km}, а дорога — от 0 до {KM_MAX}.'}
    label = stop['name'] if not shift else ('около ' + stop['gen'])[:40]
    return {'op': 'cp', 'km': km, 'label': label}


# ---------- тексты ответов ----------
def section(km, stops):
    """Участок для сайта: между соседними крупными городами вокруг км (км округлён до 10, как в GET /live/road)."""
    km = round10(km)
    big = sorted((s for s in stops if s.get('big')), key=lambda s: s['km'])
    prev = [s for s in big if s['km'] <= km]
    nxt = [s for s in big if s['km'] > km]
    if not prev:
        return 'перед ' + ins(nxt[0]) if nxt else ''
    if not nxt:
        return prev[-1].get('loc') or prev[-1]['name']
    return f'между {ins(prev[-1])} и {ins(nxt[0])}'


def hours_ago(ts_ms, now_ms):
    h = max(0, (now_ms - ts_ms) / 3600000)
    if h < 1:
        return 'меньше часа назад'
    return f'{int(h)} ч назад'


def _vlad(ts_ms):
    return dt.datetime.fromtimestamp(ts_ms / 1000, VLAD).strftime('%d.%m %H:%M')


def last_cp(st):
    return st['cps'][-1] if st.get('cps') else None


def _where(cp, stops):
    label = cp.get('label') or ('около ' + nearest(cp['km'], stops)['gen'])
    return f"{label}, ~{cp['km']} км"


def format_state(st, stops, now_ms):
    """Ответ на «/road» и после команд: статус, последняя точка, участок на сайте, ссылка."""
    lines = [f"Статус: {STATUS_RU.get(st.get('status'), st.get('status'))}."]
    if st.get('status') == 'soon':
        lines.append(f"Старт: {_vlad(st['start'])} по Владивостоку.")
    cp = last_cp(st)
    if cp:
        lines.append(f"Последняя точка: {_where(cp, stops)}, {hours_ago(cp['ts'], now_ms)}.")
        sec = section(cp['km'], stops)
        if sec:
            lines.append(f'На сайте: {sec}.')
    lines.append(ROAD_URL)
    return '\n'.join(lines)


def format_done(action, st, stops, now_ms):
    """Короткий ответ владельцу после успешной команды."""
    op = action['op']
    cp = last_cp(st)
    if op == 'cp':
        head = f"Отметил: {_where(cp, stops)}."
    elif op == 'undo':
        head = 'Убрал последнюю точку.'
    elif op == 'status':
        head = f"Статус: {STATUS_RU.get(st['status'], st['status'])}."
    elif op == 'start':
        head = f"Старт перенесён: {_vlad(st['start'])} по Владивостоку."
    else:
        return format_state(st, stops, now_ms)
    lines = [head]
    if op in ('cp', 'undo') and cp:
        if op == 'undo':
            lines.append(f"Сейчас: {_where(cp, stops)}.")
        sec = section(cp['km'], stops)
        if sec:
            lines.append(f'На сайте: {sec}.')
    lines.append(ROAD_URL)
    return '\n'.join(lines)


def reminder_due(st, now_ms, last_remind_ms=0):
    """Напоминание «Где Давид?»: в пути, последняя точка старше 20 ч, не чаще раза в сутки."""
    if not st or st.get('status') != 'run':
        return False
    cp = last_cp(st)
    if not cp or now_ms - cp['ts'] <= STALE_HOURS * 3600000:
        return False
    return now_ms - last_remind_ms >= 24 * 3600000
