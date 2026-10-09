"""Живой слой «Лофи-городов»: кто сейчас слушает, реакции и общий счётчик монеток.

Только стандартная библиотека: asyncio + минимальный WebSocket (RFC 6455, текстовые кадры).
Состояние в памяти, дневные счётчики сохраняются в JSON раз в минуту и при остановке.

Протокол (JSON):
  клиент → {"t":"hello","id":"<uuid>","city":"piter"}   (id фиксируется первым hello; повтор меняет только город)
  клиент → {"t":"react","k":"heart|note|star|moon"}
  клиент → {"t":"coin","target":"chizhik|zayats","win":true|false}
  клиент → {"t":"ev","e":"btn:play"}   (анонимная статистика нажатий: только счётчики по дням и городам, без IP)
  hello может нести "from":"<метка источника из ?from=>" — считаем уникальных посетителей по источникам
  сервер → {"t":"stats","here":N,"city":N,"today":N,"coins":{...}}
  сервер → {"t":"react","k":"heart"}
"""
import asyncio
import base64
import datetime as dt
import hashlib
import ipaddress
import json
import os
import re
import signal
import struct
import time

PORT = int(os.environ.get('PORT', '8766'))
# Отзывы: формат как у feedback.json Умножайки — их подхватывает беклог (личный беклог владельца)
FEEDBACK = os.environ.get('FEEDBACK', 'feedback.json')
FB_KINDS = {'idea': '💡 Идея', 'city': '🏙 Город', 'bug': '🐞 Ошибка', 'other': '✉️ Другое'}
fb_hits = {}  # ip -> [monotonic, ...]
fb_day = {'day': '', 'n': 0}  # общий дневной счётчик отзывов
FB_PER_HOUR = int(os.environ.get('FB_PER_HOUR', '6'))
FB_PER_DAY = int(os.environ.get('FB_PER_DAY', '300'))
FB_MAX = int(os.environ.get('FB_MAX', '5000'))  # потолок записей в feedback.json, старые обрезаются
DATA = os.environ.get('DATA', 'live-data.json')
MAX_CONN = int(os.environ.get('MAX_CONN', '5000'))
MAX_PER_IP = int(os.environ.get('MAX_PER_IP', '40'))  # за одним IP бывают сотни людей мобильного оператора
MAX_IDS = int(os.environ.get('MAX_IDS', '200000'))  # потолок множества уникальных id за день
STATS = os.environ.get('STATS', os.path.join(os.path.dirname(DATA) or '.', 'live-stats.json'))  # история по дням
STATS_DAYS = 400
EV_NAME = re.compile(r'^[a-z0-9_:.-]{1,40}$')
CITY_ID = re.compile(r'^[a-z]{2,20}$')
SRC_ID = re.compile(r'^[a-z0-9_-]{1,32}$')
EV_PER_SOCKET = 500   # больше событий с одного соединения не считаем — защита от накрутки
EV_KEYS_PER_CITY = 300
SRC_KEYS = 200
MSG_WINDOW, MSG_LIMIT = 10.0, int(os.environ.get('MSG_LIMIT', '40'))  # не больше 40 кадров за 10 с
COIN_INTERVAL = 1.0
MAX_WBUF = 64 * 1024  # клиент не читает — закрываем
REACTIONS = {'heart', 'note', 'star', 'moon'}
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
ALLOWED_ORIGINS = {'https://lofi-goroda.ru', 'https://www.lofi-goroda.ru'}
LOCAL_ORIGIN = re.compile(r'^http://(localhost|127\.0\.0\.1)(:\d{1,5})?$')
PRIVATE_NETS = [ipaddress.ip_network(n) for n in ('127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')]

clients = {}  # writer -> {'city', 'id', 'ip', 'last_react', 'last_coin', 'win', 'cnt'}
state = {'day': '', 'ids': set(), 'coins': {}, 'ev': {}, 'cu': {}, 'src': {}, 'sev': {}, 'splay': {}}  # sev: метка→событие→n, splay: метка→id, нажавшие ▶  # ev: город→событие→n, cu: город→id, src: метка→id


def today():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).strftime('%Y-%m-%d')


def load():
    try:
        with open(DATA, encoding='utf-8') as f:
            d = json.load(f)
        if d.get('day') == today():
            state.update(day=d['day'], ids=set(list(d.get('ids', []))[:MAX_IDS]), coins=d.get('coins', {}),
                         ev=d.get('ev', {}), cu={k: set(v) for k, v in d.get('cu', {}).items()},
                         src={k: set(v) for k, v in d.get('src', {}).items()},
                         sev=d.get('sev', {}), splay={k: set(v) for k, v in d.get('splay', {}).items()})
        elif d.get('day'):
            archive_day(d.get('day'), d.get('ev', {}), {k: set(v) for k, v in d.get('cu', {}).items()},
                        {k: set(v) for k, v in d.get('src', {}).items()}, d.get('sev', {}),
                        {k: set(v) for k, v in d.get('splay', {}).items()})
    except (OSError, ValueError):
        pass
    if state['day'] != today():
        state.update(day=today(), ids=set(), coins={}, ev={}, cu={}, src={}, sev={}, splay={})


def save():
    tmp = DATA + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'day': state['day'], 'ids': list(state['ids']), 'coins': state['coins'], 'ev': state['ev'],
                   'cu': {k: list(v) for k, v in state['cu'].items()},
                   'src': {k: list(v) for k, v in state['src'].items()}, 'sev': state['sev'],
                   'splay': {k: list(v) for k, v in state['splay'].items()}}, f)
    os.replace(tmp, DATA)


def archive_day(day, ev, cu, src, sev=None, splay=None):
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
                 'users': len(set().union(*cu.values())) if cu else 0}
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


def add_feedback(ip, body):
    now = time.monotonic()
    hits = [t for t in fb_hits.get(ip, []) if now - t < 3600]
    if len(hits) >= FB_PER_HOUR:
        return 429, {'ok': False, 'error': 'Слишком часто. Попробуйте через час.'}
    if fb_day['day'] != today():
        fb_day.update(day=today(), n=0)
    if fb_day['n'] >= FB_PER_DAY:
        return 429, {'ok': False, 'error': 'Сегодня уже очень много отзывов. Попробуйте завтра.'}
    try:
        m = json.loads(body or b'{}')
    except ValueError:
        return 400, {'ok': False}
    if not isinstance(m, dict):
        return 400, {'ok': False}
    text = ' '.join(str(m.get('text', '')).split())[:1000]
    if len(text) < 2:
        return 400, {'ok': False, 'error': 'Пустое сообщение'}
    kind = m.get('kind') if m.get('kind') in FB_KINDS else 'other'
    contact = ' '.join(str(m.get('contact', '')).split())[:120]
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


def http_reply(writer, code, obj, origin=''):
    body = json.dumps(obj, ensure_ascii=False).encode() if obj is not None else b''
    status = {200: 'OK', 400: 'Bad Request', 403: 'Forbidden', 413: 'Payload Too Large',
              429: 'Too Many Requests', 204: 'No Content'}.get(code, 'OK')
    # CORS только для локальной разработки: в проде сайт и /live на одном домене
    cors = ''
    if LOCAL_ORIGIN.match(origin):
        cors = (f'Access-Control-Allow-Origin: {origin}\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\n'
                'Access-Control-Allow-Headers: Content-Type\r\n')
    writer.write(f'HTTP/1.1 {code} {status}\r\nContent-Type: application/json; charset=utf-8\r\n{cors}'
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
    return {'t': 'stats', 'here': here, 'city': in_city, 'today': len(state['ids']), 'coins': state['coins']}


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
        archive_day(state['day'], state['ev'], state['cu'], state['src'], state['sev'], state['splay'])
    except Exception as e:
        print(f'archive failed: {e!r}', flush=True)
    state.update(day=today(), ids=set(), coins={}, ev={}, cu={}, src={}, sev={}, splay={})
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
    if lines[0].startswith('POST') and '/feedback' in lines[0]:
        try:
            n = int(hdr.get('content-length', '0'))
            if n > 16384 or n < 0:
                code, obj = 413, {'ok': False, 'error': 'Слишком длинно'}
            else:
                body = await asyncio.wait_for(reader.readexactly(n), 10) if n else b''
                code, obj = add_feedback(ip, body)
        except Exception:
            code, obj = 400, {'ok': False}
        http_reply(writer, code, obj, origin)
        await writer.drain()
        writer.close()
        return
    if lines[0].startswith('GET') and 'websocket' not in hdr.get('upgrade', '').lower():
        body = json.dumps(stats_for('piter')).encode()  # простая проверка здоровья: GET /live
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
    clients[writer] = {'city': 'piter', 'id': None, 'ip': ip, 'last_react': 0.0, 'last_coin': 0.0,
                       'win': time.monotonic(), 'cnt': 0, 'evn': 0, 'src': ''}
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
        clients.pop(writer, None)
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
