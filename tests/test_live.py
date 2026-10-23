"""Тесты живого слоя: 6 независимых пользователей против server/live.py.

Запуск: python tests/test_live.py — поднимает свои чистые серверы на :8799 и :8798 (малые лимиты)
с временными файлами.
Только стандартная библиотека.
"""
import asyncio
import base64
import importlib.util
import json
import os
import struct
import subprocess
import sys
import tempfile
import time
import uuid

HOST, PORT = '127.0.0.1', 8799
TMP = tempfile.mkdtemp()
FB_PATH = os.path.join(TMP, 'feedback.json')
results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f' — {detail}' if detail and not cond else ''), flush=True)


class User:
    def __init__(self, name, city='piter', port=None):
        self.name, self.city, self.id = name, city, str(uuid.uuid4())
        self.port = port or PORT
        self.inbox = []
        self.pongs = []
        self.closed = False

    async def connect(self, hello=True, origin=None, key=True):
        self.r, self.w = await asyncio.open_connection(HOST, self.port)
        extra = f'Origin: {origin}\r\n' if origin else ''
        if key:
            extra += f'Sec-WebSocket-Key: {base64.b64encode(os.urandom(16)).decode()}\r\n'
        self.w.write((f'GET /live HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                      f'{extra}Sec-WebSocket-Version: 13\r\n\r\n').encode())
        head = await self.r.readuntil(b'\r\n\r\n')
        self.status = int(head.split(b' ')[1])
        if self.status == 101:
            self.task = asyncio.create_task(self._reader())
            if hello:
                self.send({'t': 'hello', 'id': self.id, 'city': self.city})
        return self.status

    def raw(self, payload, op=0x1):
        mask = os.urandom(4)
        n = len(payload)
        head = bytes([0x80 | op]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('!H', n) if n < 65536 else bytes([0x80 | 127]) + struct.pack('!Q', n))
        self.w.write(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def send(self, obj):
        self.raw(json.dumps(obj).encode())

    async def _reader(self):
        try:
            while True:
                b1, b2 = await self.r.readexactly(2)
                n = b2 & 0x7F
                if n == 126:
                    n = struct.unpack('!H', await self.r.readexactly(2))[0]
                data = await self.r.readexactly(n)
                if b1 & 0x0F == 0x1:
                    self.inbox.append(json.loads(data))
                elif b1 & 0x0F == 0xA:
                    self.pongs.append(data)
        except Exception:
            self.closed = True

    def of(self, t):
        return [m for m in self.inbox if m.get('t') == t]

    def close(self):
        try:
            self.raw(b'', op=0x8)
            self.w.close()
        except Exception:
            pass


async def http(method, path, body=b'', headers=None, port=None):
    r, w = await asyncio.open_connection(HOST, port or PORT)
    h = ''.join(f'{k}: {v}\r\n' for k, v in (headers or {}).items())
    w.write(f'{method} {path} HTTP/1.1\r\nHost: x\r\n{h}Content-Length: {len(body)}\r\n\r\n'.encode() + body)
    data = await asyncio.wait_for(r.read(), 5)
    w.close()
    head, _, payload = data.partition(b'\r\n\r\n')
    return int(head.split(b' ')[1]), head.decode(), payload


async def main():
    users = [User(f'U{i}') for i in range(1, 7)]
    # 1. все шестеро подключаются
    codes = await asyncio.gather(*(u.connect() for u in users))
    check('01 шесть пользователей подключаются (101)', all(c == 101 for c in codes), codes)
    await asyncio.sleep(0.4)
    # 2. каждый получает статистику на hello
    check('02 каждый получил stats на hello', all(u.of('stats') for u in users))
    last = max((u.of('stats')[-1] for u in users), key=lambda m: (m['today'], m['here']))
    check('03 here == 6', last['here'] == 6, last)
    check('04 today == 6 уникальных', last['today'] == 6, last)

    # 5. повторный вход того же пользователя не увеличивает «сегодня»
    again = User('U1-again'); again.id = users[0].id
    await again.connect(); await asyncio.sleep(0.3)
    check('05 повторный вход того же id не растит today', again.of('stats')[-1]['today'] == 6, again.of('stats')[-1])
    again.close(); await asyncio.sleep(0.2)

    # 6-7. реакция доходит до всех, кроме отправителя
    users[0].send({'t': 'react', 'k': 'heart'}); await asyncio.sleep(0.4)
    got = [len([m for m in u.of('react') if m['k'] == 'heart']) for u in users]
    check('06 реакция дошла до пяти других', got[1:] == [1] * 5, got)
    check('07 отправитель не получает своё эхо', got[0] == 0, got)

    # 8. антиспам реакций: 5 подряд → дойдёт одна
    for u in users: u.inbox.clear()
    await asyncio.sleep(0.8)
    for _ in range(5): users[1].send({'t': 'react', 'k': 'star'})
    await asyncio.sleep(0.4)
    check('08 антиспам: из 5 быстрых реакций прошла 1', len(users[2].of('react')) == 1, users[2].of('react'))

    # 9. неизвестная реакция игнорируется
    users[2].send({'t': 'react', 'k': '<script>'}); await asyncio.sleep(0.8)
    check('09 неизвестная реакция отброшена', not any(m['k'] == '<script>' for m in users[3].of('react')))

    # 10-11. другой город изолирован
    users[5].send({'t': 'hello', 'id': users[5].id, 'city': 'moskva'}); await asyncio.sleep(0.3)
    users[5].inbox.clear()
    await asyncio.sleep(0.8)
    users[0].send({'t': 'react', 'k': 'moon'}); await asyncio.sleep(0.4)
    check('10 пользователь другого города не видит реакции Питера', not users[5].of('react'))
    await asyncio.sleep(5.3)
    st = users[0].of('stats')[-1]
    check('11 в Питере 5, всего 6', st['city'] == 5 and st['here'] == 6, st)

    # 11a-11d. весточки: только номер фразы, только свой город, не чаще раза в NOTE_INTERVAL
    for u in users: u.inbox.clear()
    users[0].send({'t': 'note', 'k': 3}); await asyncio.sleep(0.4)
    got = [[m['k'] for m in u.of('note')] for u in users]
    check('11a весточка дошла до Питера, без эха и без другого города', got[1:5] == [[3]] * 4 and got[0] == [] and got[5] == [], got)
    users[0].send({'t': 'note', 'k': 4}); await asyncio.sleep(0.4)
    check('11b вторая весточка сразу — отброшена', [m['k'] for m in users[1].of('note')] == [3], users[1].of('note'))
    for u in users: u.inbox.clear()
    for bad in (-1, 24, '3', 2.5, True, None):
        users[2].send({'t': 'note', 'k': bad})
    await asyncio.sleep(0.4)
    check('11c чужие номера и типы отброшены', not users[3].of('note'), users[3].of('note'))
    users[2].send({'t': 'note', 'k': 0}); await asyncio.sleep(0.4)
    check('11d после мусора честная весточка проходит', [m['k'] for m in users[3].of('note')] == [0], users[3].of('note'))

    # 11e-11f. общая герань: полив виден всему городу, повтор раньше срока не считается
    for u in users: u.inbox.clear()
    users[1].send({'t': 'water'}); users[1].send({'t': 'water'}); await asyncio.sleep(0.4)
    w = [u.of('stats')[-1]['coins'].get('water', {}).get('piter') if u.of('stats') else None for u in users[:5]]
    check('11e полив герани виден всем в Питере (1 раз, повтор отброшен)', w == [1] * 5, w)
    check('11f другой город полив не получил', not users[5].of('stats') or 'piter' not in users[5].of('stats')[-1]['coins'].get('water', {}) or users[5].inbox == [], users[5].inbox[-1:] if users[5].inbox else '')

    # 11g-11i. гитара: аккорд уходит своему городу без эха, второй сразу — отброшен, мусор — отброшен
    for u in users: u.inbox.clear()
    users[2].send({'t': 'jam', 'd': 4}); users[2].send({'t': 'jam', 'd': 0}); await asyncio.sleep(0.4)
    got = [[m['d'] for m in u.of('jam')] for u in users]
    check('11g аккорд гитары дошёл до Питера один раз, без эха и без другого города', got[2] == [] and got[5] == [] and all(g == [4] for i, g in enumerate(got[:5]) if i != 2), got)
    users[3].send({'t': 'jam', 'd': 9}); users[4].send({'t': 'jam', 'd': '1'}); await asyncio.sleep(0.4)
    check('11h ступень вне 0..6 и не число — отброшены', not users[0].of('jam')[1:], users[0].of('jam'))

    # 12-13. монетки
    users[0].send({'t': 'coin', 'target': 'chizhik', 'win': True})
    users[1].send({'t': 'coin', 'target': 'chizhik', 'win': False})
    users[2].send({'t': 'coin', 'target': 'chizhik', 'win': True})
    users[3].send({'t': 'coin', 'target': 'zayats', 'win': 'yes'})
    users[4].send({'t': 'coin', 'target': 'eiffel', 'win': True})
    await asyncio.sleep(5.3)
    coins = users[0].of('stats')[-1]['coins']
    check('12 монетки Чижику: 3 брошено, 2 на постаменте', coins.get('chizhik') == {'thrown': 3, 'won': 2}, coins)
    check('13 win="yes" не считается победой, чужая цель отброшена', coins.get('zayats') == {'thrown': 1, 'won': 0} and 'eiffel' not in coins, coins)

    # 14. мусор не рвёт соединение
    users[3].raw(b'{not json'); users[3].raw(bytes([0xff, 0xfe])); users[3].send({'t': 'ping'})
    await asyncio.sleep(0.4)
    check('14 битый JSON не рвёт соединение, ping → pong', users[3].of('pong') and not users[3].closed)

    # 15. огромный кадр → сервер закрывает только этого клиента
    big = User('Big'); await big.connect(); await asyncio.sleep(0.2)
    big.raw(b'x' * 10000); await asyncio.sleep(0.5)
    users[0].send({'t': 'ping'}); await asyncio.sleep(0.3)
    check('15 кадр >4 КБ закрывает только нарушителя', big.closed and users[0].of('pong'))

    # 16. отключение уменьшает счётчик
    users[4].close(); await asyncio.sleep(5.3)
    check('16 после ухода U5 here == 5', users[0].of('stats')[-1]['here'] == 5, users[0].of('stats')[-1])

    # 17. проверка здоровья
    code, _, body = await http('GET', '/live')
    check('17 GET /live отдаёт JSON со статистикой', code == 200 and json.loads(body)['t'] == 'stats', body[:80])

    # 18-24. обратная связь
    fb = lambda d, h=None: http('POST', '/live/feedback', json.dumps(d, ensure_ascii=False).encode(), {'Content-Type': 'application/json', **(h or {})})
    code, _, body = await fb({'kind': 'idea', 'text': 'Добавьте Казань', 'contact': '@test'})
    check('18 отзыв принят', code == 200 and json.loads(body)['ok'], body)
    code, _, _ = await fb({'kind': 'idea', 'text': ' '})
    check('19 пустой отзыв → 400', code == 400)
    code, _, _ = await http('POST', '/live/feedback', b'{oops', {'Content-Type': 'application/json'})
    check('20 битый JSON отзыва → 400', code == 400)
    await fb({'kind': 'hack', 'text': 'А' * 5000})
    await fb({'kind': 'city', 'text': '<img src=x onerror=alert(1)> Владивосток'})
    if FB_PATH:
        items = json.load(open(FB_PATH, encoding='utf-8'))
        check('21 формат совместим с беклогом (id, ts, text, from, status)', all({'id', 'ts', 'text', 'from', 'status'} <= set(i) for i in items), items[:1])
        long = [i for i in items if 'AAA' in i['text'] or 'ААА' in i['text']]
        check('22 длинный текст обрезан до 1000, чужой kind → «другое»', long and len(long[0]['text']) <= 1015 and long[0]['kind'] == 'other', long[:1])
        check('23 HTML хранится как текст, без изменений', any('<img' in i['text'] for i in items))
    code, _, _ = await fb({'kind': 'idea', 'text': 'чужой сайт'}, {'Origin': 'https://evil.example'})
    check('23b POST отзыва с чужим Origin → 403', code == 403, code)
    code, _, _ = await fb({'kind': 'idea', 'text': 'подделка'}, {'Origin': 'https://lofi-goroda.ru.evil.example'})
    check('23c POST отзыва с Origin-подделкой → 403', code == 403, code)
    code, _, _ = await fb({'kind': 'idea', 'text': 'со своего сайта'}, {'Origin': 'https://lofi-goroda.ru'})
    check('23d POST отзыва с Origin lofi-goroda.ru → 200', code == 200, code)
    if FB_PATH:
        items = json.load(open(FB_PATH, encoding='utf-8'))
        check('23e отзыв с чужим Origin не сохранён', not any('чужой сайт' in i['text'] or 'подделка' in i['text'] for i in items))
    code_list = [ (await fb({'kind': 'bug', 'text': f'спам {i}'}))[0] for i in range(5)]
    check('24 антиспам отзывов: 7-й за час → 429', 429 in code_list, code_list)

    # 25-26. CORS
    code, head, _ = await http('OPTIONS', '/live/feedback', headers={'Origin': 'http://localhost:8765'})
    check('25 preflight с localhost → 204 + ACAO', code == 204 and 'Access-Control-Allow-Origin: http://localhost:8765' in head, head)
    code, head, _ = await http('OPTIONS', '/live/feedback', headers={'Origin': 'https://evil.example'})
    check('26 чужой origin не получает ACAO', 'Access-Control-Allow-Origin' not in head, head)

    # 27. лимит подключений с одного IP (MAX_PER_IP=20 на тестовом сервере)
    extra = [User(f'X{i}') for i in range(20)]
    statuses = []
    for x in extra:
        statuses.append(await x.connect(hello=False))
    check('27 сверх лимита с одного IP → 429', statuses.count(429) >= 1 and statuses[0] == 101, statuses)
    for x in extra: x.close()

    # 28. мусорный запрос не роняет сервер
    r, w = await asyncio.open_connection(HOST, PORT); w.write(b'\x00\x01garbage\r\n\r\n'); await w.drain(); w.close()
    await asyncio.sleep(0.3)
    code, _, _ = await http('GET', '/live')
    check('28 после мусорного запроса сервер жив', code == 200)

    # 29. кириллица и эмодзи в реакциях/отзывах
    code, _, body = await fb({'kind': 'idea', 'text': 'Мурманск 🌌 северное сияние'}, {'X-Real-IP': '10.0.0.9'})
    check('29 эмодзи и кириллица в отзыве', code == 200, body)

    # 31. слишком большое тело → 413
    code, _, _ = await http('POST', '/live/feedback', b'x' * 20000, {'Content-Type': 'application/json', 'X-Real-IP': '10.0.0.10'})
    check('31 тело больше 16 КБ → 413', code == 413, code)

    # 30. корректное закрытие
    users[1].close(); await asyncio.sleep(5.3)
    check('30 close-кадр обработан, here == 4', users[0].of('stats')[-1]['here'] == 4, users[0].of('stats')[-1])

    # 30b-30c. длительность сессии и возвраты (DUR_STEPS=1 на тестовом сервере)
    code, _, body = await http('GET', '/live')
    stb = json.loads(body)
    check('30b после отключений засчитана длительность (dur:1s)', stb['ev'].get('piter', {}).get('dur:1s', 0) >= 1,
          stb['ev'].get('piter', {}))
    check('30c повторные визиты в тот же день — не возврат (ret7 == 0)', stb.get('ret7') == 0, stb.get('ret7'))

    # 32. повторный hello на том же сокете не добавляет новый id
    today0 = json.loads((await http('GET', '/live'))[2])['today']
    for _ in range(3):
        users[0].send({'t': 'hello', 'id': str(uuid.uuid4()), 'city': 'piter'})
    await asyncio.sleep(0.4)
    today1 = json.loads((await http('GET', '/live'))[2])['today']
    check('32 повторный hello с новым id не растит today', today1 == today0, (today0, today1))

    # 33-34. монетка не чаще раза в секунду на соединение
    coins_now = lambda body: json.loads(body)['coins'].get('zayats', {}).get('thrown', 0)
    z0 = coins_now((await http('GET', '/live'))[2])
    for _ in range(5):
        users[2].send({'t': 'coin', 'target': 'zayats', 'win': False})
    await asyncio.sleep(0.4)
    z1 = coins_now((await http('GET', '/live'))[2])
    check('33 из 5 быстрых монеток засчитана 1', z1 - z0 == 1, (z0, z1))
    await asyncio.sleep(1.1)
    users[2].send({'t': 'coin', 'target': 'zayats', 'win': False}); await asyncio.sleep(0.3)
    z2 = coins_now((await http('GET', '/live'))[2])
    check('34 через секунду монетка снова принимается', z2 - z1 == 1, (z1, z2))

    # 35. флуд кадрами: >40 за 10 с → сервер закрывает только нарушителя
    flood = User('Flood'); await flood.connect(); await asyncio.sleep(0.2)
    for _ in range(50):
        flood.send({'t': 'ping'})
    await asyncio.sleep(0.5)
    users[0].inbox.clear(); users[0].send({'t': 'ping'}); await asyncio.sleep(0.3)
    check('35 флуд >40 кадров за 10 с закрывает сокет', flood.closed and users[0].of('pong'), (flood.closed, len(flood.of('pong'))))
    flood.close()

    # 36. ping длиннее 125 байт игнорируется, соединение живо
    users[3].inbox.clear(); users[3].pongs.clear()
    users[3].raw(b'p' * 200, op=0x9); users[3].raw(b'hi', op=0x9); users[3].send({'t': 'ping'})
    await asyncio.sleep(0.4)
    check('36 длинный ping без ответа, короткий → pong-кадр', users[3].pongs == [b'hi'] and users[3].of('pong') and not users[3].closed, users[3].pongs)

    # 37-40. Origin и Sec-WebSocket-Key
    evil = User('Evil'); st_evil = await evil.connect(origin='https://evil.example')
    check('37 чужой Origin → 403', st_evil == 403, st_evil)
    loc = User('Loc'); st_loc = await loc.connect(origin='http://localhost:8765')
    prod = User('Prod'); st_prod = await prod.connect(origin='https://lofi-goroda.ru')
    check('38 Origin localhost и lofi-goroda.ru → 101', st_loc == 101 and st_prod == 101, (st_loc, st_prod))
    nokey = User('NoKey'); st_nokey = await nokey.connect(key=False)
    check('39 без Sec-WebSocket-Key → 400', st_nokey == 400, st_nokey)
    tricky = User('Tricky'); st_tricky = await tricky.connect(origin='https://lofi-goroda.ru.evil.example')
    check('40 Origin-подделка с префиксом домена → 403', st_tricky == 403, st_tricky)
    loc.close(); prod.close()

    # 41-44. IP клиента: от 127.0.0.1 доверяем X-Real-IP, иначе крайнему правому X-Forwarded-For
    xff = {'X-Forwarded-For': '1.1.1.1, 10.20.30.40'}
    codes = [(await fb({'kind': 'bug', 'text': f'xff {i}'}, xff))[0] for i in range(7)]
    check('41 X-Forwarded-For: считается крайний правый адрес (6 ок, 7-й 429)', codes == [200] * 6 + [429], codes)
    c_same = (await fb({'kind': 'bug', 'text': 'real'}, {'X-Real-IP': '10.20.30.40'}))[0]
    c_left = (await fb({'kind': 'bug', 'text': 'left'}, {'X-Forwarded-For': '10.20.30.40, 10.20.30.41'}))[0]
    check('42 тот же IP через X-Real-IP → 429, другой крайний правый → 200', c_same == 429 and c_left == 200, (c_same, c_left))
    spec = importlib.util.spec_from_file_location('live_mod', os.path.join(ROOT, 'server', 'live.py'))
    os.environ['FAKE_TODAY'] = '2026-10-12'  # подмена «сегодня» только для импортируемого модуля (подпроцессы уже со своим env)
    live = importlib.util.module_from_spec(spec); spec.loader.exec_module(live)
    del os.environ['FAKE_TODAY']
    ip_cases = [
        (live.client_ip('8.8.8.8', {'x-real-ip': '1.2.3.4'}), '8.8.8.8'),
        (live.client_ip('8.8.8.8', {'x-forwarded-for': '1.2.3.4'}), '8.8.8.8'),
        (live.client_ip('172.18.0.2', {'x-forwarded-for': '6.6.6.6, 5.5.5.5'}), '5.5.5.5'),
        (live.client_ip('192.168.1.5', {'x-real-ip': '5.5.5.5'}), '5.5.5.5'),
        (live.client_ip('172.32.0.1', {'x-real-ip': '5.5.5.5'}), '172.32.0.1'),
        (live.client_ip('10.0.0.1', {}), '10.0.0.1'),
    ]
    check('43 заголовкам прокси верим только от частных сетей', all(a == b for a, b in ip_cases), ip_cases)
    check('44 Origin: пустой, 127.0.0.1:порт, www — можно; localhost.evil и http://lofi-goroda.ru — нет',
          live.origin_allowed('') and live.origin_allowed('http://127.0.0.1:5500') and live.origin_allowed('https://www.lofi-goroda.ru')
          and not live.origin_allowed('http://localhost.evil.com') and not live.origin_allowed('http://lofi-goroda.ru'))

    # 44a-44h. юнит-проверки удержания: длительности, возвраты, чистка карты seen
    check('44a duration_evs: 30 с — порогов нет', live.duration_evs(30) == [])
    check('44b duration_evs: 90 с → dur:1m', live.duration_evs(90) == ['dur:1m'])
    check('44c duration_evs: 700 с → dur:1m, dur:5m, dur:10m', live.duration_evs(700) == ['dur:1m', 'dur:5m', 'dur:10m'])
    live.state.update(day='2026-10-12', seen={}, ret7=0)
    live.note_return('visitor-1')
    check('44d первый визит — не возврат', live.state['ret7'] == 0, live.state['ret7'])
    live.state['day'] = '2026-10-15'
    live.note_return('visitor-1')
    check('44e визит через 3 дня — возврат', live.state['ret7'] == 1, live.state['ret7'])
    live.note_return('visitor-1')
    check('44f повторный визит в тот же день — не второй возврат', live.state['ret7'] == 1, live.state['ret7'])
    live.state['day'] = '2026-10-24'
    live.note_return('visitor-1')
    check('44g визит через 9 дней — не возврат', live.state['ret7'] == 1, live.state['ret7'])
    check('44h prune_seen режет хэши старше 8 суток',
          set(live.prune_seen({'old': '2026-10-01', 'edge': '2026-10-04', 'fresh': '2026-10-12'})) == {'edge', 'fresh'},
          live.prune_seen({'old': '2026-10-01', 'edge': '2026-10-04', 'fresh': '2026-10-12'}))

    # 44i. раунд-трип диска: ret7 и seen сохраняются и читаются
    live.DATA = os.path.join(TMP, 'roundtrip.json')
    live.state.update(ret7=4, seen={'abc123def456': '2026-10-12'})
    live.save()
    with open(live.DATA, encoding='utf-8') as f:
        saved = json.load(f)
    check('44i save() пишет ret7 и seen', saved.get('ret7') == 4 and saved.get('seen') == {'abc123def456': '2026-10-12'},
          {k: saved.get(k) for k in ('ret7', 'seen')})

    for u in users: u.close()

    # 44j-l. отзывы бота: лимит по contact, а не по IP (FB_PER_HOUR=6 по умолчанию)
    ip = {'X-Real-IP': '10.7.7.7'}
    bot = {**ip, 'X-Bot-Key': 'test-bot-key'}
    codes = [(await fb({'kind': 'other', 'text': f'от бота {i}', 'contact': f'tg:{i}'}, bot))[0] for i in range(8)]
    check('44j бот с верным ключом: 8 разных contact с одного IP проходят', codes == [200] * 8, codes)
    codes = [(await fb({'kind': 'other', 'text': f'один {i}', 'contact': 'tg:@same'}, bot))[0] for i in range(7)]
    check('44k бот: лимит по одному contact (6 в час, 7-й → 429)', codes == [200] * 6 + [429], codes)
    codes = [(await fb({'kind': 'other', 'text': f'без ключа {i}', 'contact': f'tg:{i}'}, ip))[0] for i in range(7)]
    check('44l без ключа лимит по IP: 7-й → 429', codes == [200] * 6 + [429], codes)
    codes = [(await fb({'kind': 'other', 'text': f'чужой ключ {i}', 'contact': f'tg:w{i}'}, {'X-Real-IP': '10.7.7.8', 'X-Bot-Key': 'wrong'}))[0] for i in range(7)]
    check('44m неверный ключ — как без ключа (по IP)', codes == [200] * 6 + [429], codes)

    # 45-47. второй сервер с малыми лимитами: дневной лимит отзывов, потолок записей, потолок ids
    fb2 = lambda d, ip: http('POST', '/live/feedback', json.dumps(d, ensure_ascii=False).encode(),
                             {'Content-Type': 'application/json', 'X-Real-IP': ip}, port=PORT2)
    codes = [(await fb2({'kind': 'idea', 'text': f'день {i}'}, f'10.9.0.{i}'))[0] for i in range(4)]
    check('45 дневной лимит отзывов (FB_PER_DAY=3): 4-й → 429', codes == [200, 200, 200, 429], codes)
    items = json.load(open(FB2_PATH, encoding='utf-8'))
    check('46 feedback.json обрезан до FB_MAX=5, старые ушли, новые в конце',
          len(items) == 5 and items[-1]['text'].endswith('день 2') and not any(i['text'] == 'old 0' for i in items),
          [i['text'] for i in items])
    many = [User(f'M{i}', port=PORT2) for i in range(5)]
    for m in many:
        await m.connect()
    await asyncio.sleep(0.4)
    st = json.loads((await http('GET', '/live', port=PORT2))[2])
    check('47 потолок уникальных id (MAX_IDS=3)', st['today'] == 3 and st['here'] == 5, st)
    for m in many: m.close()

    # 48-52b. выдача отзывов боту: GET /feedback/since (только с ключом, только отзывы с сайта)
    code, _, _ = await http('GET', '/live/feedback/since?ts=0')
    check('48 /feedback/since без ключа → 403', code == 403, code)
    code, _, _ = await http('GET', '/live/feedback/since?ts=0', headers={'X-Bot-Key': 'wrong'})
    check('49 /feedback/since с неверным ключом → 403', code == 403, code)
    code, _, _ = await http('GET', '/live/feedback/since?ts=0', port=PORT2)
    check('49b при пустом BOT_KEY на сервере → 403', code == 403, code)
    key = {'X-Bot-Key': 'test-bot-key'}
    code, _, body = await http('GET', '/live/feedback/since?ts=0', headers=key)
    items = json.loads(body)
    check('50 с верным ключом → список с сайта, ровно поля ts/text/kind/city/from, без tg:',
          code == 200 and isinstance(items, list) and items
          and all(not str(i['from']).startswith('tg:') for i in items)
          and all({'ts', 'text', 'kind', 'city', 'from'} == set(i) for i in items), items[:1])
    max_ts = max(i['ts'] for i in items)
    while True:  # выдача постраничная (по 20): листаем до конца, чтобы метка стала действительно последней
        code, _, body = await http('GET', f'/live/feedback/since?ts={max_ts}', headers=key)
        page = json.loads(body)
        if not page:
            break
        max_ts = page[-1]['ts']
    await fb({'kind': 'idea', 'text': 'после метки'}, {'X-Real-IP': '10.8.8.1'})
    await fb({'kind': 'bug', 'text': 'от бота после метки', 'contact': 'tg:99'}, bot)
    code, _, body = await http('GET', f'/live/feedback/since?ts={max_ts}', headers=key)
    items2 = json.loads(body)
    check('51 фильтр по ts: только новые с сайта, отзыв бота (tg:) не попал, по возрастанию',
          code == 200 and [i['text'] for i in items2] == ['💡 Идея: после метки']
          and all(i['ts'] > max_ts for i in items2), items2)
    for i in range(23):
        await fb({'kind': 'other', 'text': f'пачка {i:02d}'}, {'X-Real-IP': f'10.11.0.{i}'})
    code, _, body = await http('GET', f'/live/feedback/since?ts={max_ts}', headers=key)
    items3 = json.loads(body)
    check('52 не больше 20 за раз: сначала старые, по возрастанию ts',
          code == 200 and len(items3) == 20 and items3[0]['text'] == '💡 Идея: после метки'
          and all(items3[i]['ts'] < items3[i + 1]['ts'] for i in range(19)), len(items3))

    # 53-69. «Дорога»: состояние поездки /live/road
    key = {'X-Bot-Key': 'test-bot-key', 'Content-Type': 'application/json'}
    rpost = lambda d, h=key, port=None: http('POST', '/live/road', json.dumps(d, ensure_ascii=False).encode(), h, port=port)
    code, head, body = await http('GET', '/live/road')
    st = json.loads(body)
    check('53 GET /live/road по умолчанию: soon, старт 19.10 08:00 Владивостока, одна точка',
          code == 200 and st == {'status': 'soon', 'start': 1792360800000, 'updated': 1792360800000, 'notes': 0,
                                 'cps': [{'km': 0, 'ts': 1792360800000, 'label': 'Владивосток'}]}, st)
    check('53b GET публичный, с Cache-Control: max-age=60', 'Cache-Control: max-age=60' in head, head)
    code, head, _ = await http('GET', '/live/road', headers={'Origin': 'http://localhost:8765'})
    check('53c CORS для localhost в GET', 'Access-Control-Allow-Origin: http://localhost:8765' in head, head)
    code, _, _ = await rpost({'cmd': 'cp', 'km': 100}, {'Content-Type': 'application/json'})
    check('54 POST без ключа → 403', code == 403, code)
    code, _, _ = await rpost({'cmd': 'cp', 'km': 100}, {'X-Bot-Key': 'wrong'})
    check('55 POST с неверным ключом → 403', code == 403, code)
    code, _, _ = await rpost({'cmd': 'cp', 'km': 100}, {'X-Bot-Key': ''}, port=PORT2)
    check('56 при пустом BOT_KEY (даже с пустым заголовком) → 403', code == 403, code)
    code, _, _ = await rpost({'cmd': 'cp', 'km': 100}, {'X-Bot-Key': 'x'}, port=PORT2)
    check('56b при пустом BOT_KEY с любым ключом → 403', code == 403, code)
    st = json.loads((await http('GET', '/live/road'))[2])
    check('57 после отказов состояние не изменилось', st['status'] == 'soon' and len(st['cps']) == 1, st)
    t0 = int(time.time() * 1000)
    code, _, body = await rpost({'cmd': 'cp', 'km': 2925, 'label': 'Чита'})
    st = json.loads(body)
    check('58 cp: status soon → run, точка добавлена, ts — время сервера',
          code == 200 and st['status'] == 'run' and len(st['cps']) == 2 and abs(st['cps'][-1]['ts'] - t0) < 5000
          and st['cps'][-1]['label'] == 'Чита' and st['updated'] >= t0, st)
    check('59 km в ответе округлён до 10 (2925 → 2930)', st['cps'][-1]['km'] == 2930, st['cps'])
    check('59b GET отдаёт то же состояние', json.loads((await http('GET', '/live/road'))[2]) == st)
    codes = [(await rpost(d))[0] for d in ({'cmd': 'cp', 'km': -1}, {'cmd': 'cp', 'km': 9281}, {'cmd': 'cp', 'km': '100'},
                                           {'cmd': 'cp', 'km': 1.5}, {'cmd': 'cp', 'km': True}, {'cmd': 'cp'},
                                           {'cmd': 'boom'}, [1])]
    check('60 km вне 0..9280, не int, нет cmd → 400', codes == [400] * 8, codes)
    code, _, _ = await http('POST', '/live/road', b'{oops', key)
    check('60b битый JSON → 400', code == 400, code)
    code, _, body = await rpost({'cmd': 'cp', 'km': 9280, 'label': 'М' * 100})
    st = json.loads(body)
    check('61 граница km=9280 принимается, label обрезан до 40', code == 200 and st['cps'][-1]['km'] == 9280
          and len(st['cps'][-1]['label']) == 40, st['cps'][-1])
    code, _, body = await rpost({'cmd': 'cp', 'km': 0})
    check('61b граница km=0 принимается', code == 200 and json.loads(body)['cps'][-1]['km'] == 0)
    for _ in range(2):
        code, _, body = await rpost({'cmd': 'undo'})
    st = json.loads(body)
    check('62 undo убирает последние точки', code == 200 and len(st['cps']) == 2 and st['cps'][-1]['label'] == 'Чита', st['cps'])
    await rpost({'cmd': 'undo'})
    code, _, body = await rpost({'cmd': 'undo'})
    st = json.loads((await http('GET', '/live/road'))[2])
    check('63 undo не удаляет стартовую точку (400)', len(st['cps']) == 1 and st['cps'][0]['km'] == 0 and code == 400, (code, st['cps']))
    code, _, body = await rpost({'cmd': 'status', 'status': 'pause'})
    check('64 status pause', code == 200 and json.loads(body)['status'] == 'pause', body)
    code, _, body = await rpost({'cmd': 'status', 'status': 'run'})
    check('64b status run', json.loads(body)['status'] == 'run', body)
    code, _, _ = await rpost({'cmd': 'status', 'status': 'fly'})
    check('64c неизвестный status → 400', code == 400, code)
    code, _, body = await rpost({'cmd': 'cp', 'km': 500, 'label': 'x'})
    check('64d cp при status run статус не меняет', json.loads(body)['status'] == 'run', body)
    await rpost({'cmd': 'status', 'status': 'pause'})
    code, _, body = await rpost({'cmd': 'cp', 'km': 600, 'label': 'y'})
    check('64e cp при паузе снимает паузу (попутчик снова в пути)', json.loads(body)['status'] == 'run', body)
    new_start = 1792447200000
    code, _, body = await rpost({'cmd': 'start', 'ts': new_start})
    st = json.loads(body)
    check('65 start переносит старт и ts стартовой точки', code == 200 and st['start'] == new_start
          and st['cps'][0]['ts'] == new_start, st)
    code, _, _ = await rpost({'cmd': 'start', 'ts': 'вчера'})
    check('65b start с нечисловым ts → 400', code == 400, code)
    for i in range(205):
        await rpost({'cmd': 'cp', 'km': i})
    st = json.loads((await http('GET', '/live/road'))[2])
    check('66 cps не больше 200, хранятся последние', len(st['cps']) == 200 and st['cps'][-1]['km'] == 200,
          (len(st['cps']), st['cps'][-1]))
    code, _, body = await http('POST', '/live/road', b'x' * 5000, key)
    check('66b слишком большое тело → 413', code == 413, code)
    code, _, _ = await http('GET', '/live/road?x=1')
    check('66c GET с query работает', code == 200)
    code, _, body = await http('GET', '/live')
    check('66d /live и /live/feedback/since не задеты новым путём', code == 200 and json.loads(body)['t'] == 'stats'
          and (await http('GET', '/live/feedback/since?ts=0', headers={'X-Bot-Key': 'test-bot-key'}))[0] == 200)
    code, _, _ = await http('POST', '/live/road', b'{}', {'X-Bot-Key': 'test-bot-key', 'Origin': 'https://evil.example'})
    check('66e POST с чужим Origin → 403', code == 403, code)
    # сохранение: файл на диске и новый процесс видят то же состояние
    await rpost({'cmd': 'undo'})
    await rpost({'cmd': 'cp', 'km': 2925, 'label': 'Чита'})
    saved = json.load(open(ROAD_PATH, encoding='utf-8'))
    check('67 road.json на диске: точный km 2925 (в GET — 2930), статус run, ≤200 точек',
          saved['cps'][-1]['km'] == 2925 and saved['status'] == 'run' and len(saved['cps']) == 200, saved['cps'][-1])
    before = json.loads((await http('GET', '/live/road'))[2])
    srv3 = subprocess.Popen([sys.executable, os.path.join(ROOT, 'server', 'live.py')], env=env3, stdout=subprocess.DEVNULL)
    try:
        await asyncio.sleep(1.5)
        after = json.loads((await http('GET', '/live/road', port=PORT3))[2])
    finally:
        srv3.terminate()
    check('68 после перезапуска процесса состояние то же', after == before, (before['updated'], after['updated']))
    bad = os.path.join(TMP, 'road-bad.json')
    open(bad, 'w').write('{"status":')
    check('69 битый road.json → состояние по умолчанию', _road_from(bad)['status'] == 'soon')

    # 70. весточки в дорогу: счётчик поездки в /live/road, только из окна doroga, с тем же лимитом раз в NOTE_INTERVAL
    nA, nB, nC = User('rA', city='doroga'), User('rB', city='doroga'), User('rC', city='piter')
    for u in (nA, nB, nC): await u.connect()
    await asyncio.sleep(0.3)
    nA.send({'t': 'note', 'k': 1}); await asyncio.sleep(0.4)
    get_notes = lambda: http('GET', '/live/road')
    check('70 весточка из doroga → notes == 1 в /live/road', json.loads((await get_notes())[2]).get('notes') == 1)
    nA.send({'t': 'note', 'k': 2}); await asyncio.sleep(0.4)
    check('70b вторая сразу (лимит) не считается', json.loads((await get_notes())[2]).get('notes') == 1)
    nB.send({'t': 'note', 'k': 5}); nC.send({'t': 'note', 'k': 5}); await asyncio.sleep(0.4)
    check('70c весточка другого слушателя doroga считается, из piter — нет', json.loads((await get_notes())[2]).get('notes') == 2)
    nB.send({'t': 'note', 'k': 99}); await asyncio.sleep(0.3)
    check('70d мусорный номер не считается', json.loads((await get_notes())[2]).get('notes') == 2)
    check('70e счётчик сохранён на диск', json.load(open(ROAD_PATH, encoding='utf-8')).get('notes') == 2)
    code, _, body = await rpost({'cmd': 'status', 'status': 'run'})
    check('70f команды бота счётчик не трогают', code == 200 and json.loads(body)['notes'] == 2)
    for u in (nA, nB, nC): u.w.close()

    ok = sum(1 for _, c, _ in results if c)
    print(f'\nИТОГО: {ok}/{len(results)} пройдено', flush=True)


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT2 = 8798
PORT3 = 8797
ROAD_PATH = os.path.join(TMP, 'road-main.json')
FB2_PATH = os.path.join(TMP, 'feedback2.json')
with open(FB2_PATH, 'w', encoding='utf-8') as f:  # старые записи: должны обрезаться до FB_MAX
    json.dump([{'id': i, 'ts': i, 'text': f'old {i}', 'from': 'сайт', 'status': 'new', 'reason': ''} for i in range(10)], f)
env = dict(os.environ, PORT=str(PORT), DATA=os.path.join(TMP, 'live.json'), FEEDBACK=FB_PATH, MAX_PER_IP='20',
           DUR_STEPS='1', BOT_KEY='test-bot-key', ROAD=ROAD_PATH)  # порог длительности 1 с: любое соединение с id после отключения даёт dur:1s
env2 = dict(os.environ, PORT=str(PORT2), DATA=os.path.join(TMP, 'live2.json'), FEEDBACK=FB2_PATH,
            FB_PER_DAY='3', FB_MAX='5', MAX_IDS='3', BOT_KEY='', ROAD=os.path.join(TMP, 'road2.json'))
env3 = dict(os.environ, PORT=str(PORT3), DATA=os.path.join(TMP, 'live3.json'), FEEDBACK=os.path.join(TMP, 'fb3.json'),
            BOT_KEY='test-bot-key', ROAD=ROAD_PATH)  # «перезапуск»: новый процесс читает тот же road.json


def _road_from(path):
    spec = importlib.util.spec_from_file_location('live_road_mod', os.path.join(ROOT, 'server', 'live.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.ROAD = path
    mod.road_load()
    return mod.road_view()


def run():
    global srv, srv2
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'server', 'live.py')], env=env, stdout=subprocess.DEVNULL)
    srv2 = subprocess.Popen([sys.executable, os.path.join(ROOT, 'server', 'live.py')], env=env2, stdout=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        asyncio.run(main())
    finally:
        srv.terminate()
        srv2.terminate()
    return all(c for _, c, _ in results)


def test_live():
    assert run(), [n for n, c, _ in results if not c]


if __name__ == '__main__':
    sys.exit(0 if run() else 1)
