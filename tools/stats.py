"""Анонимная статистика Лофи-городов: посетители, нажатия, источники по дням.

Читает с сервера по ssh два файла live.py: историю по дням (live-stats.json) и текущий день (live-data.json).
Запуск:  python tools/stats.py            — последние 7 дней
         python tools/stats.py 30         — последние 30 дней
         python tools/stats.py 7 kazan    — один город подробно
Переменная HOST — ssh-хост (по умолчанию myvps2)."""
import collections
import json
import os
import subprocess
import sys

HOST = os.environ.get('HOST', 'myvps2')
DIR = '/opt/lofi-goroda/data'
days_n = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 7
only = sys.argv[2] if len(sys.argv) > 2 else None


def remote_json(path):
    r = subprocess.run(['ssh', '-o', 'BatchMode=yes', HOST, f'cat {path} 2>/dev/null || echo {{}}'],
                       capture_output=True, check=True)
    return json.loads(r.stdout.decode('utf-8') or '{}')


hist = remote_json(f'{DIR}/live-stats.json')
cur = remote_json(f'{DIR}/live-data.json')
if cur.get('day'):  # сегодняшний день — из текущего состояния, те же поля, что в истории
    cu = {c: set(v) for c, v in cur.get('cu', {}).items()}
    cities = {c: dict(cur.get('ev', {}).get(c, {})) for c in set(cur.get('ev', {})) | set(cu)}
    for c in cities:
        cities[c]['users'] = len(cu.get(c, ()))
    hist[cur['day'] + ' (сегодня)'] = {'cities': cities, 'from': {k: len(v) for k, v in cur.get('src', {}).items()},
                                       'users': len(set().union(*cu.values())) if cu else 0}

days = sorted(hist)[-days_n:]
if not days:
    sys.exit('Статистики пока нет.')

PLAY = ('btn:play', 'spot:player')
print(f'{"день":24} {"людей":>6} {"откр.":>6} {"▶":>5} {"кликов":>7}')
total = collections.Counter()
src_total = collections.Counter()
for d in days:
    h = hist[d]
    cs = {c: v for c, v in h['cities'].items() if not only or c == only}
    users = sum(v.get('users', 0) for v in cs.values()) if only else h.get('users', 0)
    opens = sum(v.get('open', 0) for v in cs.values())
    plays = sum(v.get(k, 0) for v in cs.values() for k in PLAY)
    clicks = sum(n for v in cs.values() for k, n in v.items() if k not in ('users', 'open'))
    print(f'{d:24} {users:6} {opens:6} {plays:5} {clicks:7}')
    for v in cs.values():
        total.update({k: n for k, n in v.items() if k != 'users'})
    src_total.update(h.get('from', {}))

print('\nГорода за период (уникальные за день, суммой; открытия):')
by_city = collections.Counter()
opens_city = collections.Counter()
for d in days:
    for c, v in hist[d]['cities'].items():
        by_city[c] += v.get('users', 0)
        opens_city[c] += v.get('open', 0)
for c, n in by_city.most_common():
    if not only or c == only:
        print(f'  {c:14} людей {n:5}   открытий {opens_city[c]:5}')

print('\nЧто нажимают (топ-25):')
for k, n in total.most_common(26):
    if k != 'open':
        print(f'  {k:32} {n}')

print('\nИсточники (?from=), уникальных посетителей:')
for k, n in src_total.most_common() or [('— меток пока нет', 0)]:
    print(f'  {k:32} {n}')
