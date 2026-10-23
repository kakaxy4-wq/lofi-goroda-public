"""Живой слой «Лофи-городов»: кто сейчас слушает, реакции и общий счётчик монеток.

Только стандартная библиотека: asyncio + минимальный WebSocket (RFC 6455, текстовые кадры).
Состояние в памяти, дневные счётчики сохраняются в JSON раз в минуту и при остановке.

Протокол (JSON):
  клиент → {"t":"hello","id":"<uuid>","city":"piter"}   (id фиксируется первым hello; повтор меняет только город)
  клиент → {"t":"react","k":"heart|note|star|moon"}
  клиент → {"t":"note","k":<номер готовой фразы 0..NOTES-1>}   (весточка: не чаще раза в NOTE_INTERVAL с, текст фраз — на клиенте)
  клиент → {"t":"coin","target":"chizhik|zayats","win":true|false}
  клиент → {"t":"jam","d":<ступень аккорда 0..6>}   (гитара у окна: не чаще раза в JAM_INTERVAL с; остальным в городе — тот же аккорд)
  клиент → {"t":"water"}   (полить общую герань своего города; не чаще раза в WATER_INTERVAL с; счёт — coins.water[город] за день)
  клиент → {"t":"ev","e":"btn:play"}   (анонимная статистика нажатий: только счётчики по дням и городам, без IP)
  hello может нести "from":"<метка источника из ?from=>" — считаем уникальных посетителей по источникам
  сервер → {"t":"stats","here":N,"city":N,"today":N,"coins":{...}}
  сервер → {"t":"react","k":"heart"}
  сервер → {"t":"note","k":3}   (весточка от слушателя того же города)
  сервер → {"t":"jam","d":4}   (аккорд гитары от слушателя того же города)
"""
import asyncio
import base64
import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import os
import re
import signal
import struct
import time
import urllib.parse

PORT = int(os.environ.get('PORT', '8766'))
# Отзывы: формат как у feedback.json Умножайки — их подхватывает беклог (личный беклог владельца)
FEEDBACK = os.environ.get('FEEDBACK', 'feedback.json')
FB_KINDS = {'idea': '💡 Идея', 'city': '🏙 Город', 'bug': '🐞 Ошибка', 'other': '✉️ Другое'}
fb_hits = {}  # ip -> [monotonic, ...]
fb_day = {'day': '', 'n': 0}  # общий дневной счётчик отзывов
FB_PER_HOUR = int(os.environ.get('FB_PER_HOUR', '6'))
FB_PER_DAY = int(os.environ.get('FB_PER_DAY', '300'))
BOT_KEY = os.environ.get('BOT_KEY', '')  # ключ бота @oknodnya_bot: его отзывы лимитируются по contact, а не по IP
FB_MAX = int(os.environ.get('FB_MAX', '5000'))  # потолок записей в feedback.json, старые обрезаются
DATA = os.environ.get('DATA', 'live-data.json')
MAX_CONN = int(os.environ.get('MAX_CONN', '5000'))
MAX_PER_IP = int(os.environ.get('MAX_PER_IP', '40'))  # за одним IP бывают сотни людей мобильного оператора
MAX_IDS = int(os.environ.get('MAX_IDS', '200000'))  # потолок множества уникальных id за день
STATS = os.environ.get('STATS', os.path.join(os.path.dirname(DATA) or '.', 'live-stats.json'))  # история по дням
STATS_DAYS = 400
FAKE_TODAY = os.environ.get('FAKE_TODAY')             # только тесты: подмена сегодняшнего дня
SEEN_MAX = int(os.environ.get('SEEN_MAX', '100000'))  # потолок карты возвратов (хэш id → день)
ROAD = os.environ.get('ROAD', os.path.join(os.path.dirname(DATA) or '.', 'road.json'))  # состояние поездки «Дорога»
DUR_STEPS = [float(x) for x in os.environ.get('DUR_STEPS', '60,300,600,1800').split(',')]  # пороги длительности сессии


def _dur_name(s):
    return f'dur:{int(s) // 60}m' if s >= 60 and s % 60 == 0 else f'dur:{int(s)}s'


DUR = [(s, _dur_name(s)) for s in DUR_STEPS]  # [(60, 'dur:1m'), (300, 'dur:5m'), …]
EV_NAME = re.compile(r'^[a-z0-9_:.-]{1,40}$')
CITY_ID = re.compile(r'^[a-z][a-z-]{1,19}$')  # okno-dnya — с дефисом
SRC_ID = re.compile(r'^[a-z0-9_-]{1,32}$')
EV_PER_SOCKET = 500   # больше событий с одного соединения не считаем — защита от накрутки
EV_KEYS_PER_CITY = 300
SRC_KEYS = 200
MSG_WINDOW, MSG_LIMIT = 10.0, int(os.environ.get('MSG_LIMIT', '40'))  # не больше 40 кадров за 10 с
COIN_INTERVAL = 1.0
MAX_WBUF = 64 * 1024  # клиент не читает — закрываем
REACTIONS = {'heart', 'note', 'star', 'moon'}
NOTES = 24  # число готовых фраз-весточек; свободного текста нет — модерировать нечего
NOTE_INTERVAL = float(os.environ.get('NOTE_INTERVAL', '30'))
JAM_INTERVAL = float(os.environ.get('JAM_INTERVAL', '1.5'))
DAY_CITY = 'okno-dnya'
WATER_INTERVAL = float(os.environ.get('WATER_INTERVAL', '600'))
NEVER = float('-inf')  # «последнего действия не было»: time.monotonic() считается от включения машины, 0.0 сразу после перезагрузки — «только что»
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
ALLOWED_ORIGINS = {'https://lofi-goroda.ru', 'https://www.lofi-goroda.ru'}
LOCAL_ORIGIN = re.compile(r'^http://(localhost|127\.0\.0\.1)(:\d{1,5})?$')
PRIVATE_NETS = [ipaddress.ip_network(n) for n in ('127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]

clients = {}  # writer -> {'city', 'id', 'ip', 'last_react', 'last_coin', 'win', 'cnt'}
state = {'day': '', 'ids': set(), 'coins': {}, 'ev': {}, 'cu': {}, 'src': {}, 'sev': {}, 'splay': {},
         'ret7': 0, 'seen': {}}  # sev: метка→событие→n, splay: метка→id, нажавшие ▶  # ev: город→событие→n, cu: город→id, src: метка→id
# ret7: вернувшиеся за 7 суток (счётчик за день); seen: неполный хэш id → последний день (8 суток, окно возврата с запасом)


def today():
    if FAKE_TODAY:
        return FAKE_TODAY
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).strftime('%Y-%m-%d')


def load():
    try:
        with open(DATA, encoding='utf-8') as f:
            d = json.load(f)
        seen = prune_seen({str(k): str(v) for k, v in d.get('seen', {}).items()})
        if d.get('day') == today():
            state.update(day=d['day'], ids=set(list(d.get('ids', []))[:MAX_IDS]), coins=d.get('coins', {}),
                         ev=d.get('ev', {}), cu={k: set(v) for k, v in d.get('cu', {}).items()},
                         src={k: set(v) for k, v in d.get('src', {}).items()},
                         sev=d.get('sev', {}), splay={k: set(v) for k, v in d.get('splay', {}).items()},
                         ret7=int(d.get('ret7', 0)), seen=seen)
        elif d.get('day'):
            archive_day(d.get('day'), d.get('ev', {}), {k: set(v) for k, v in d.get('cu', {}).items()},
                        {k: set(v) for k, v in d.get('src', {}).items()}, d.get('sev', {}),
                        {k: set(v) for k, v in d.get('splay', {}).items()}, d.get('ret7', 0))
            state.update(seen=seen)
    except (OSError, ValueError):
        pass
    if state['day'] != today():
        state.update(day=today(), ids=set(), coins={}, ev={}, cu={}, src={}, sev={}, splay={},
                     ret7=0, seen=prune_seen(state['seen']))  # seen не стирать: окно возврата 8 суток


def save():
    tmp = DATA + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'day': state['day'], 'ids': list(state['ids']), 'coins': state['coins'], 'ev': state['ev'],
                   'cu': {k: list(v) for k, v in state['cu'].items()},
                   'src': {k: list(v) for k, v in state['src'].items()}, 'sev': state['sev'],
                   'splay': {k: list(v) for k, v in state['splay'].items()},
                   'ret7': state['ret7'], 'seen': state['seen']}, f)
    os.replace(tmp, DATA)


def archive_day(day, ev, cu, src, sev=None, splay=None, ret7=0):
    """Итоги дня — в историю: только числа (события, уникальные посетители по городам и источникам), без id и IP."""
    if not day or not (ev or cu or src):
        return
    try:
        with open(STATS, encoding='utf-8') as f:
            hist = json.load(f)
    except (OSError, ValueError):
        hist = {}
    cities = {c: dict(ev.get(c, {})) for c in set(ev) | set(cu)}
    for c in cities:
        cities[c]['users'] = len(cu.get(c, ()))
    hist[day] = {'cities': cities, 'from': {k: len(v) for k, v in src.items()},
                 'from_ev': sev or {}, 'from_play': {k: len(v) for k, v in (splay or {}).items()},
                 'users': len(set().union(*cu.values())) if cu else 0, 'ret7': int(ret7 or 0)}
    for old in sorted(hist)[:-STATS_DAYS]:
        del hist[old]
    tmp = STATS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(hist, f, ensure_ascii=False, sort_keys=True)
    os.replace(tmp, STATS)


def count_ev(city, name, n=1):
    box = state['ev'].setdefault(city, {})
    if name in box or len(box) < EV_KEYS_PER_CITY:
        box[name] = box.get(name, 0) + n


def prune_seen(seen):
    """Хэши за последние 8 суток: окно возврата 7 дней с запасом на смену суток."""
    limit = (dt.date.fromisoformat(today()) - dt.timedelta(days=8)).isoformat()
    return {h: d for h, d in seen.items() if d >= limit}


def duration_evs(sec):
    """Пороги длительности соединения: 700 с → ['dur:1m', 'dur:5m', 'dur:10m']."""
    return [name for s, name in DUR if sec >= s]


def note_return(cid):
    """Визит id: если последний был в предыдущие 7 суток — возврат (раз в день на id)."""
    h = hashlib.sha256(cid.encode()).hexdigest()[:16]  # неполный хэш: id не восстановить
    last = state['seen'].get(h, '')
    if last and last != state['day']:
        try:
            gap = (dt.date.fromisoformat(state['day']) - dt.date.fromisoformat(last)).days
        except ValueError:
            gap = 0
        if 1 <= gap <= 7:
            state['ret7'] += 1
    if h in state['seen'] or len(state['seen']) < SEEN_MAX:
        state['seen'][h] = state['day']


def safe_save():
    try:
        save()
    except Exception as e:  # падение записи (диск, права) не должно убивать процесс
        print(f'save failed: {e!r}', flush=True)


def is_private(addr):
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    if getattr(ip, 'ipv4_mapped', None):
        ip = ip.ipv4_mapped
    return any(ip in n for n in PRIVATE_NETS)


def client_ip(peer, hdr):
    """Заголовкам прокси доверяем, только если соединение пришло из частной сети (Traefik в docker)."""
    if not is_private(peer):
        return peer
    real = hdr.get('x-real-ip', '').strip()
    if real:
        return real[:64]
    xff = [p.strip() for p in hdr.get('x-forwarded-for', '').split(',') if p.strip()]
    return xff[-1][:64] if xff else peer


def origin_allowed(origin):
    return not origin or origin in ALLOWED_ORIGINS or bool(LOCAL_ORIGIN.match(origin))


def cleanup_fb_hits():
    now = time.monotonic()
    for ip in list(fb_hits):
        hits = [t for t in fb_hits[ip] if now - t < 3600]
        if hits:
            fb_hits[ip] = hits
        else:
            del fb_hits[ip]


def bot_ok(hdr):
    """Запрос от нашего бота: заголовок X-Bot-Key совпал с BOT_KEY (пустой ключ в окружении — бот выключен)."""
    got = hdr.get('x-bot-key', '')
    return bool(BOT_KEY) and hmac.compare_digest(got.encode(), BOT_KEY.encode())


def add_feedback(ip, body, bot=False):
    try:
        m = json.loads(body or b'{}')
    except ValueError:
        return 400, {'ok': False}
    if not isinstance(m, dict):
        return 400, {'ok': False}
    contact = ' '.join(str(m.get('contact', '')).split())[:120]
    if bot:  # все запросы бота идут с одного адреса: лимит по tg-пользователю
        ip = 'bot:' + (contact or '?')
    now = time.monotonic()
    hits = [t for t in fb_hits.get(ip, []) if now - t < 3600]
    if len(hits) >= FB_PER_HOUR:
        return 429, {'ok': False, 'error': 'Слишком часто. Попробуйте через час.'}
    if fb_day['day'] != today():
        fb_day.update(day=today(), n=0)
    if fb_day['n'] >= FB_PER_DAY:
        return 429, {'ok': False, 'error': 'Сегодня уже очень много отзывов. Попробуйте завтра.'}
    text = ' '.join(str(m.get('text', '')).split())[:1000]
    if len(text) < 2:
        return 400, {'ok': False, 'error': 'Пустое сообщение'}
    kind = m.get('kind') if m.get('kind') in FB_KINDS else 'other'
    fb_hits[ip] = hits + [now]
    fb_day['n'] += 1
    try:
        with open(FEEDBACK, encoding='utf-8') as f:
            items = json.load(f)
        if not isinstance(items, list):
            items = []
    except (OSError, ValueError):
        items = []
    ts = int(time.time() * 1000)
    items.append({'id': ts, 'ts': ts, 'text': f"{FB_KINDS[kind]}: {text}", 'from': contact or 'сайт',
                  'kind': kind, 'city': str(m.get('city', ''))[:20], 'status': 'new', 'reason': ''})
    items = items[-FB_MAX:]
    tmp = FEEDBACK + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False)
    os.replace(tmp, FEEDBACK)
    return 200, {'ok': True}


def feedback_since(ts):
    """Отзывы с сайта после ts (мс): не из бота (from без «tg:» — их владелец уже получил в Telegram),
    не больше 20 за раз — сначала старые (бот продвинет метку и заберёт остальные), по возрастанию ts."""
    try:
        with open(FEEDBACK, encoding='utf-8') as f:
            items = json.load(f)
        if not isinstance(items, list):
            items = []
    except (OSError, ValueError):
        items = []
    fresh = [i for i in items if isinstance(i, dict) and isinstance(i.get('ts'), int)
             and i['ts'] > ts and not str(i.get('from', '')).startswith('tg:')]
    fresh.sort(key=lambda i: i['ts'])
    return [{'ts': i['ts'], 'text': i['text'], 'kind': i.get('kind', 'other'),
             'city': i.get('city', ''), 'from': i.get('from', '')} for i in fresh[:20]]


# ---------- «Дорога»: состояние поездки (data/road.json), GET публичный, POST только с ключом бота ----------
ROAD_KM_MAX = 9280                  # Владивосток (0) — Москва
ROAD_START = 1792360800000          # 19.10.2026 08:00 по Владивостоку = 18.10 22:00 UTC
ROAD_STATUSES = ('soon', 'run', 'pause', 'done')
ROAD_CPS_MAX = 200
ROAD_LABEL_MAX = 40
ROAD_NOTES_MAX = 10 ** 9
ROAD_CITY = 'doroga'  # весточки из окна этого города считаем за поездку (road.json, поле notes)
road = None


def road_default():
    return {'status': 'soon', 'start': ROAD_START, 'updated': ROAD_START, 'notes': 0,
            'cps': [{'km': 0, 'ts': ROAD_START, 'label': 'Владивосток'}]}


def is_int(v):
    return type(v) is int


def road_load():
    """Читает road.json; битый или отсутствующий файл — состояние по умолчанию."""
    global road
    road = road_default()
    try:
        with open(ROAD, encoding='utf-8') as f:
            d = json.load(f)
        cps = [{'km': c['km'], 'ts': c['ts'], 'label': str(c.get('label', ''))[:ROAD_LABEL_MAX]}
               for c in d['cps'] if is_int(c.get('km')) and 0 <= c['km'] <= ROAD_KM_MAX and is_int(c.get('ts'))]
        if d.get('status') in ROAD_STATUSES and is_int(d.get('start')) and cps:
            road = {'status': d['status'], 'start': d['start'], 'cps': cps[-ROAD_CPS_MAX:],
                    'updated': d['updated'] if is_int(d.get('updated')) else d['start'],
                    'notes': d['notes'] if is_int(d.get('notes')) and 0 <= d['notes'] <= ROAD_NOTES_MAX else 0}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        pass


def road_save():
    tmp = ROAD + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(road, f, ensure_ascii=False)
    os.replace(tmp, ROAD)


def road_view():
    """Публичный вид: километры округлены до 10 (точное место попутчика не раскрываем)."""
    if road is None:
        road_load()
    return {'status': road['status'], 'start': road['start'], 'updated': road['updated'],
            'notes': road.get('notes', 0),
            'cps': [{'km': min(ROAD_KM_MAX, int(c['km'] / 10 + 0.5) * 10), 'ts': c['ts'], 'label': c['label']}
                    for c in road['cps']]}


def road_note():
    """Весточка в окне «Дороги» дошла до слушателей: +1 к счётчику поездки (хранится в road.json)."""
    if road is None:
        road_load()
    road['notes'] = min(ROAD_NOTES_MAX, road.get('notes', 0) + 1)
    try:
        road_save()
    except OSError as e:
        print(f'road save failed: {e!r}', flush=True)


def road_apply(body):
    """POST от бота → (код, объект). Меняет состояние и пишет файл."""
    if road is None:
        road_load()
    try:
        m = json.loads(body or b'{}')
    except ValueError:
        return 400, {'ok': False, 'error': 'bad json'}
    if not isinstance(m, dict):
        return 400, {'ok': False, 'error': 'bad json'}
    cmd = m.get('cmd')
    now_ms = int(time.time() * 1000)
    if cmd == 'cp':
        km = m.get('km')
        if not is_int(km) or not 0 <= km <= ROAD_KM_MAX:
            return 400, {'ok': False, 'error': f'km 0..{ROAD_KM_MAX}'}
        label = ' '.join(str(m.get('label', '')).split())[:ROAD_LABEL_MAX]
        road['cps'] = (road['cps'] + [{'km': km, 'ts': now_ms, 'label': label}])[-ROAD_CPS_MAX:]
        if road['status'] in ('soon', 'pause'):  # новая точка = попутчик снова в пути (кнопка «Да» в боте снимает паузу)
            road['status'] = 'run'
    elif cmd == 'status':
        if m.get('status') not in ROAD_STATUSES:
            return 400, {'ok': False, 'error': 'status: ' + '|'.join(ROAD_STATUSES)}
        road['status'] = m['status']
    elif cmd == 'undo':
        if len(road['cps']) <= 1:
            return 400, {'ok': False, 'error': 'nothing to undo'}
        road['cps'].pop()
    elif cmd == 'start':
        ts = m.get('ts')
        if not is_int(ts) or ts <= 0:
            return 400, {'ok': False, 'error': 'ts: ms'}
        road['start'] = ts
        if road['cps'] and road['cps'][0]['km'] == 0:  # стартовая точка едет вместе со стартом
            road['cps'][0]['ts'] = ts
    else:
        return 400, {'ok': False, 'error': 'cmd: cp|status|undo|start'}
    road['updated'] = now_ms
    try:
        road_save()
    except OSError as e:
        print(f'road save failed: {e!r}', flush=True)
        return 500, {'ok': False, 'error': 'save failed'}
    return 200, road_view()


def http_reply(writer, code, obj, origin='', extra=''):
    body = json.dumps(obj, ensure_ascii=False).encode() if obj is not None else b''
    status = {200: 'OK', 400: 'Bad Request', 403: 'Forbidden', 413: 'Payload Too Large',
              429: 'Too Many Requests', 204: 'No Content', 500: 'Internal Server Error'}.get(code, 'OK')
    # CORS только для локальной разработки: в проде сайт и /live на одном домене
    cors = ''
    if LOCAL_ORIGIN.match(origin):
        cors = (f'Access-Control-Allow-Origin: {origin}\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\n'
                'Access-Control-Allow-Headers: Content-Type\r\n')
    writer.write(f'HTTP/1.1 {code} {status}\r\nContent-Type: application/json; charset=utf-8\r\n{cors}{extra}'
                 f'Content-Length: {len(body)}\r\nConnection: close\r\n\r\n'.encode() + body)


def frame(text):
    data = text.encode()
    n = len(data)
    if n < 126:
        head = struct.pack('!BB', 0x81, n)
    elif n < 65536:
        head = struct.pack('!BBH', 0x81, 126, n)
    else:
        head = struct.pack('!BBQ', 0x81, 127, n)
    return head + data


async def read_frame(reader):
    b1, b2 = await reader.readexactly(2)
    op, masked, n = b1 & 0x0F, b2 & 0x80, b2 & 0x7F
    if n == 126:
        n = struct.unpack('!H', await reader.readexactly(2))[0]
    elif n == 127:
        n = struct.unpack('!Q', await reader.readexactly(8))[0]
    if n > 4096:
        raise ValueError('frame too big')
    mask = await reader.readexactly(4) if masked else b'\0\0\0\0'
    data = bytearray(await reader.readexactly(n))
    for i in range(n):
        data[i] ^= mask[i % 4]
    return op, bytes(data)


def drop(w):
    """Жёстко закрыть соединение (клиент не читает, буфер переполнен)."""
    clients.pop(w, None)
    try:
        w.transport.abort()
    except Exception:
        pass


def write_checked(w, data):
    try:
        w.write(data)
        if w.transport.get_write_buffer_size() > MAX_WBUF:
            drop(w)
    except Exception:
        pass


def send(w, obj):
    write_checked(w, frame(json.dumps(obj, ensure_ascii=False)))


def stats_for(city):
    here = len(clients)
    in_city = sum(1 for c in clients.values() if c['city'] == city)
    st = {'t': 'stats', 'here': here, 'city': in_city, 'today': len(state['ids']), 'coins': state['coins']}
    if city == DAY_CITY:  # «Окно дня»: сколько сегодня угадали город за шторой
        st['daySolved'] = state['ev'].get(DAY_CITY, {}).get('day:solved', 0)
    return st


def broadcast_stats():
    cache = {}
    for w, c in list(clients.items()):
        if c['city'] not in cache:
            cache[c['city']] = stats_for(c['city'])
        send(w, cache[c['city']])


def add_id(cid):
    if cid in state['ids'] or len(state['ids']) < MAX_IDS:
        state['ids'].add(cid)


def new_day():
    try:
        archive_day(state['day'], state['ev'], state['cu'], state['src'], state['sev'], state['splay'], state['ret7'])
    except Exception as e:
        print(f'archive failed: {e!r}', flush=True)
    state.update(day=today(), ids=set(), coins={}, ev={}, cu={}, src={}, sev={}, splay={},
                 ret7=0, seen=prune_seen(state['seen']))  # seen не стирать: окно возврата 8 суток
    for c in clients.values():  # те, кто слушает через полночь, — тоже слушатели нового дня
        if c['id']:
            add_id(c['id'])


async def handle(reader, writer):
    peer = (writer.get_extra_info('peername') or ('?',))[0]
    try:
        head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 10)
    except Exception:
        writer.close()
        return
    lines = head.decode('latin-1').split('\r\n')
    hdr = {k.strip().lower(): v.strip() for k, _, v in (l.partition(':') for l in lines[1:] if ':' in l)}
    ip = client_ip(peer, hdr)
    origin = hdr.get('origin', '')
    if lines[0].startswith('OPTIONS'):
        http_reply(writer, 204, None, origin)
        await writer.drain()
        writer.close()
        return
    if lines[0].startswith('POST') and not origin_allowed(origin):  # как у WebSocket: чужой Origin → 403
        http_reply(writer, 403, {'ok': False, 'error': 'Forbidden'}, origin)
        await writer.drain()
        writer.close()
        return
    path = lines[0].split(' ')[1].partition('?')[0] if lines[0].count(' ') >= 2 else ''
    if path in ('/road', '/live/road') and lines[0].startswith(('GET', 'POST')):  # раньше общих веток: они ищут подстроки
        if lines[0].startswith('GET'):
            http_reply(writer, 200, road_view(), origin, 'Cache-Control: max-age=60\r\n')
        elif not bot_ok(hdr):
            http_reply(writer, 403, {'ok': False, 'error': 'Forbidden'}, origin)
        else:
            try:
                n = int(hdr.get('content-length', '0'))
                if n > 4096 or n < 0:
                    code, obj = 413, {'ok': False, 'error': 'too long'}
                else:
                    body = await asyncio.wait_for(reader.readexactly(n), 10) if n else b''
                    code, obj = road_apply(body)
            except Exception:
                code, obj = 400, {'ok': False}
            http_reply(writer, code, obj, origin)
        await writer.drain()
        writer.close()
        return
    if lines[0].startswith('POST') and '/feedback' in lines[0]:
        try:
            n = int(hdr.get('content-length', '0'))
            if n > 16384 or n < 0:
                code, obj = 413, {'ok': False, 'error': 'Слишком длинно'}
            else:
                body = await asyncio.wait_for(reader.readexactly(n), 10) if n else b''
                code, obj = add_feedback(ip, body, bot_ok(hdr))
        except Exception:
            code, obj = 400, {'ok': False}
        http_reply(writer, code, obj, origin)
        await writer.drain()
        writer.close()
        return
    if lines[0].startswith('GET') and '/feedback/since' in lines[0]:
        if not bot_ok(hdr):  # только наш бот: без ключа, с неверным или при пустом BOT_KEY — 403
            http_reply(writer, 403, {'ok': False, 'error': 'Forbidden'}, origin)
        else:
            try:
                last = int(urllib.parse.parse_qs(lines[0].split(' ')[1].partition('?')[2]).get('ts', ['0'])[0])
            except ValueError:
                last = 0
            http_reply(writer, 200, feedback_since(last))
        await writer.drain()
        writer.close()
        return
    if lines[0].startswith('GET') and 'websocket' not in hdr.get('upgrade', '').lower():
        # проверка здоровья: GET /live (ev и ret7 — только в этом HTTP-ответе, для тестов и отладки)
        body = json.dumps({**stats_for('piter'), 'ev': state['ev'], 'ret7': state['ret7']}).encode()
        writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n' % len(body) + body)
        await writer.drain()
        writer.close()
        return
    if not origin_allowed(origin):
        writer.write(b'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
        writer.close()
        return
    key = hdr.get('sec-websocket-key')
    if not key:
        writer.write(b'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
        writer.close()
        return
    per_ip = sum(1 for c in clients.values() if c['ip'] == ip)
    if len(clients) >= MAX_CONN or per_ip >= MAX_PER_IP:
        writer.write(b'HTTP/1.1 429 Too Many\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
        writer.close()
        return
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                  f'Sec-WebSocket-Accept: {accept}\r\n\r\n').encode())
    clients[writer] = {'city': 'piter', 'id': None, 'ip': ip, 'last_react': NEVER, 'last_coin': NEVER,
                       'win': time.monotonic(), 'cnt': 0, 'evn': 0, 'src': '', 't0': time.monotonic()}
    try:
        while True:
            op, data = await asyncio.wait_for(read_frame(reader), 90)
            c = clients.get(writer)
            if c is None:  # сброшен из-за переполненного буфера
                break
            now = time.monotonic()
            if now - c['win'] > MSG_WINDOW:
                c['win'], c['cnt'] = now, 0
            c['cnt'] += 1
            if c['cnt'] > MSG_LIMIT:
                break
            if op == 0x8:
                break
            if op == 0x9:
                if len(data) <= 125:  # управляющий кадр длиннее 125 — нарушение протокола, не отвечаем
                    write_checked(writer, b'\x8a' + bytes([len(data)]) + data)
                continue
            if op != 0x1:
                continue
            try:
                msg = json.loads(data)
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            t = msg.get('t')
            if t == 'hello':
                city = str(msg.get('city', 'piter'))[:20]
                c['city'] = city if CITY_ID.match(city) else 'other'
                cid = str(msg.get('id', ''))[:40]
                if cid and c['id'] is None:  # один id на сокет: повторный hello id не меняет
                    c['id'] = cid
                    add_id(cid)
                    note_return(cid)
                    count_ev(c['city'], 'open')
                    users = state['cu'].setdefault(c['city'], set())
                    if len(users) < MAX_IDS:
                        users.add(cid)
                    src = str(msg.get('from', '') or '').lower()[:32]
                    if src and SRC_ID.match(src) and (src in state['src'] or len(state['src']) < SRC_KEYS):
                        c['src'] = src
                        bucket = state['src'].setdefault(src, set())
                        if len(bucket) < MAX_IDS:
                            bucket.add(cid)
                send(writer, stats_for(c['city']))
            elif t == 'ev':
                name = str(msg.get('e', ''))[:40]
                if c['id'] and EV_NAME.match(name) and c['evn'] < EV_PER_SOCKET:
                    c['evn'] += 1
                    count_ev(c['city'], name)
                    if c['src']:  # события тех, кто пришёл по метке ?from= — по источнику
                        box = state['sev'].setdefault(c['src'], {})
                        if name in box or len(box) < 60:
                            box[name] = box.get(name, 0) + 1
                        if name in ('btn:play', 'spot:player'):
                            played = state['splay'].setdefault(c['src'], set())
                            if len(played) < MAX_IDS:
                                played.add(c['id'])
            elif t == 'react' and msg.get('k') in REACTIONS:
                if now - c['last_react'] < 0.7:
                    continue
                c['last_react'] = now
                for w, o in list(clients.items()):
                    if w is not writer and o['city'] == c['city']:
                        send(w, {'t': 'react', 'k': msg['k']})
            elif t == 'jam' and type(msg.get('d')) is int and 0 <= msg['d'] <= 6:
                if now - c.get('last_jam', NEVER) < JAM_INTERVAL:
                    continue
                c['last_jam'] = now
                for w, o in list(clients.items()):
                    if w is not writer and o['city'] == c['city']:
                        send(w, {'t': 'jam', 'd': msg['d']})
            elif t == 'note' and type(msg.get('k')) is int and 0 <= msg['k'] < NOTES:
                if now - c.get('last_note', NEVER) < NOTE_INTERVAL:
                    continue
                c['last_note'] = now
                if c['city'] == ROAD_CITY:
                    road_note()
                for w, o in list(clients.items()):
                    if w is not writer and o['city'] == c['city']:
                        send(w, {'t': 'note', 'k': msg['k']})
            elif t == 'water':
                if now - c.get('last_water', NEVER) < WATER_INTERVAL:
                    continue
                c['last_water'] = now
                box = state['coins'].setdefault('water', {})
                if c['city'] in box or len(box) < 200:
                    box[c['city']] = box.get(c['city'], 0) + 1
                for w, o in list(clients.items()):  # все в этом городе сразу видят, что герань полили
                    if o['city'] == c['city']:
                        send(w, stats_for(c['city']))
            elif t == 'coin' and msg.get('target') in ('chizhik', 'zayats'):
                if now - c['last_coin'] < COIN_INTERVAL:
                    continue
                c['last_coin'] = now
                box = state['coins'].setdefault(msg['target'], {'thrown': 0, 'won': 0})
                box['thrown'] += 1
                box['won'] += 1 if msg.get('win') is True else 0
            elif t == 'ping':
                send(writer, {'t': 'pong'})
    except Exception:
        pass
    finally:
        c = clients.pop(writer, None)
        if c and c.get('id') and c.get('t0'):  # сессия с id: считаем пороги длительности соединения
            for name in duration_evs(time.monotonic() - c['t0']):
                count_ev(c['city'], name)
        try:
            writer.close()
        except Exception:
            pass


async def ticker():
    n = 0
    while True:
        await asyncio.sleep(5)
        try:
            if state['day'] != today():
                new_day()
            broadcast_stats()
            n += 1
            if n % 12 == 0:
                safe_save()
                cleanup_fb_hits()
        except Exception as e:
            print(f'ticker error: {e!r}', flush=True)


async def main():
    load()
    road_load()
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError):  # Windows: обычный обработчик сигнала
            signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop.set))
    server = await asyncio.start_server(handle, '0.0.0.0', PORT, limit=8192)
    print(f'live on :{PORT}', flush=True)
    tick = asyncio.create_task(ticker())
    try:
        await stop.wait()
    finally:
        tick.cancel()
        server.close()
        safe_save()
        print('live stopped, state saved', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
