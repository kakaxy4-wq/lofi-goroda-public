"""Кадры для финального таймлапса «9000 км за 3 минуты»: когда снимать, имена файлов, чистка, статистика.
Чистые функции и работа с каталогом, без Telegram и браузера (снимок делает render.py)."""
import datetime as dt
import os
import re

EVERY = 600          # секунд между кадрами
MAX_FRAMES = 4000    # старые удаляем
SOON_WINDOW_MS = 3600000  # до старта меньше часа — уже снимаем
NAME = re.compile(r'^\d{8}-\d{4}\.(png|jpg)$')


def should_shoot(st, now_ms):
    """st — ответ GET /live/road. Снимаем в пути и на паузе, а до старта — только за час."""
    if not isinstance(st, dict):
        return False
    s = st.get('status')
    if s in ('run', 'pause'):
        return True
    return s == 'soon' and isinstance(st.get('start'), int) and st['start'] - now_ms < SOON_WINDOW_MS


def frame_name(t):
    """YYYYMMDD-HHMM.jpg по UTC."""
    return t.astimezone(dt.timezone.utc).strftime('%Y%m%d-%H%M') + '.jpg'


def frames(directory):
    try:
        return sorted(f for f in os.listdir(directory) if NAME.match(f))
    except OSError:
        return []


def save(directory, png, t):
    """Атомарно пишет кадр и чистит лишнее. → путь."""
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, frame_name(t))
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(png)
    os.replace(tmp, path)
    prune(directory)
    return path


def prune(directory, keep=MAX_FRAMES):
    names = frames(directory)
    for f in names[:max(0, len(names) - keep)]:
        try:
            os.remove(os.path.join(directory, f))
        except OSError:
            pass


def stats(directory):
    """→ {'count','first','last','bytes'}; first/last — имена файлов или None."""
    names = frames(directory)
    size = 0
    for f in names:
        try:
            size += os.path.getsize(os.path.join(directory, f))
        except OSError:
            pass
    return {'count': len(names), 'first': names[0] if names else None, 'last': names[-1] if names else None, 'bytes': size}


def pretty_name(name):
    """20261019-0810.png → «19.10 08:10 UTC»."""
    m = re.match(r'(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})', name or '')
    return f'{m.group(3)}.{m.group(2)} {m.group(4)}:{m.group(5)} UTC' if m else '—'


def format_stats(s):
    if not s['count']:
        return 'Кадров таймлапса пока нет. Снимаю раз в 10 минут, когда Давид в пути, на паузе или до старта остался час.'
    mb = s['bytes'] / 1048576
    size = f'{mb / 1024:.2f} ГБ' if mb >= 1024 else f'{mb:.0f} МБ'
    return (f"Кадров таймлапса: {s['count']} (хранится не больше {MAX_FRAMES}).\n"
            f"Первый: {pretty_name(s['first'])}\nПоследний: {pretty_name(s['last'])}\nРазмер папки: {size}.")
