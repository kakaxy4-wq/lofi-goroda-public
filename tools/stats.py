"""Анонимная статистика Лофи-городов: посетители, нажатия, источники по дням.

Читает с сервера по ssh два файла live.py: историю по дням (live-stats.json) и текущий день (live-data.json).
Запуск:  python tools/stats.py            — последние 7 дней
         python tools/stats.py 30         — последние 30 дней
         python tools/stats.py 7 kazan    — один город подробно
Переменная HOST — ssh-хост (по умолчанию myvps2); HOST=local — читать файлы с диска (папка — STATS_DIR)."""
import collections
import json
import os
import subprocess
import sys

HOST = os.environ.get('HOST', 'myvps2')
DIR = os.environ.get('STATS_DIR', '/opt/lofi-goroda/data')
days_n = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 7
only = sys.argv[2] if len(sys.argv) > 2 else None


def remote_json(path):
    if HOST == 'local':  # без сервера: файлы с диска (проверка вывода на фикстурах)
        try:
            with open(path, encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}
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
                                       'from_ev': cur.get('sev', {}), 'from_play': {k: len(v) for k, v in cur.get('splay', {}).items()},
                                       'users': len(set().union(*cu.values())) if cu else 0,
                                       'ret7': cur.get('ret7', 0)}

days = sorted(hist)[-days_n:]
if not days:
    sys.exit('Статистики пока нет.')

PLAY = ('btn:play', 'spot:player')
print(f'{"день":24} {"людей":>6} {"откр.":>6} {"▶":>5} {"кликов":>7} {"верн.":>5}')
total = collections.Counter()
src_total = collections.Counter()
src_play = collections.Counter()
src_ev = collections.defaultdict(collections.Counter)
users_sum = ret_sum = 0
for d in days:
    h = hist[d]
    cs = {c: v for c, v in h['cities'].items() if not only or c == only}
    users = sum(v.get('users', 0) for v in cs.values()) if only else h.get('users', 0)
    opens = sum(v.get('open', 0) for v in cs.values())
    plays = sum(v.get(k, 0) for v in cs.values() for k in PLAY)
    # клики — нажатия людей; ttfs:/dur: считаются сами (время/длительность), в «кликах» им не место
    clicks = sum(n for v in cs.values() for k, n in v.items()
                 if k not in ('users', 'open') and not k.startswith(('ttfs:', 'dur:')))
    ret = h.get('ret7', 0)
    print(f'{d:24} {users:6} {opens:6} {plays:5} {clicks:7} {ret:5}')
    users_sum += users
    ret_sum += ret
    for v in cs.values():
        total.update({k: n for k, n in v.items() if k != 'users'})
    src_total.update(h.get('from', {}))
    src_play.update(h.get('from_play', {}))
    for k, v in h.get('from_ev', {}).items():
        src_ev[k].update(v)

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

print('\nУдержание:')
TTFS_ORDER = ['ttfs:0-5', 'ttfs:5-15', 'ttfs:15-60', 'ttfs:60-300', 'ttfs:300']  # в порядке бакетов, не по алфавиту; «300» — открытый сверху («+» в именах событий запрещён)
ttfs_n = sum(total.get(k, 0) for k in TTFS_ORDER)
if ttfs_n:
    buckets = ' · '.join(f'{k} {total.get(k, 0)} ({total.get(k, 0) / ttfs_n * 100:3.0f}%)' for k in TTFS_ORDER if total.get(k))
    print(f'  первый звук, с от открытия (включений {ttfs_n}): {buckets}')
else:
    print('  первый звук: данных пока нет (события ttfs:* — с 12.10.2026)')
open_n = total.get('open', 0)
print('  сессии: ' + ' · '.join(f'{k} {total.get(k, 0)}' for k in ('dur:1m', 'dur:5m', 'dur:10m', 'dur:30m'))
      + (f' → доля ≥10 мин = {total.get("dur:10m", 0) / open_n * 100:3.0f}% от {open_n} открытий' if open_n else ''))
print('  (сессии считаются по соединениям: перезагрузка страницы и переподключения дробят их — доля ≥10 мин занижена)')
if users_sum:
    print(f'  вернулись за 7 дней: {ret_sum} из {users_sum} человеко-дней ({ret_sum / users_sum * 100:3.0f}%)')
else:
    print('  вернулись за 7 дней: данных пока нет')
share_sent = sum(total.get(f'share:{k}', 0) for k in ('tg', 'vk', 'native', 'copy', 'download'))
print(f'  открытки: share:open {total.get("share:open", 0)} → отправили {share_sent} → from=share пришло {src_total.get("share", 0)} → ▶ {src_play.get("share", 0)} (подробно — в «Источниках»)')

print('\nИсточники (?from=): пришло людей → из них нажали ▶ (уникальные за день, суммой)')
for k, n in src_total.most_common() or [('— меток пока нет', 0)]:
    pl = src_play.get(k, 0)
    extra = ', '.join(f'{e} {c}' for e, c in src_ev[k].most_common() if e.startswith(('share', 'link:boosty', 'secret')))[:80]
    print(f'  {k:24} {n:4} → ▶ {pl:3} ({pl / n * 100 if n else 0:3.0f}%)' + (f'   [{extra}]' if extra else ''))
print('  (▶ по источникам считается с 08.10.2026)')
