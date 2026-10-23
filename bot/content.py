"""Тексты и выбор города для бота — без Telegram и браузера, чтобы тестировалось."""
import datetime as dt
import re

NO_REPEAT_DAYS = 14
CAPTION_MAX = 1024   # подпись к фото
MESSAGE_MAX = 4096   # обычное сообщение
HM = re.compile(r'^([01]?\d|2[0-3]):[0-5]\d$')


def pick_city(cities, history, today, skip=()):
    """Окно дня: по кругу из включённых городов, без повтора за 14 дней, детерминированно от даты.

    history — [(ГГГГ-ММ-ДД, id города)], skip — id, которые нельзя (например, «другой город»).
    """
    ok = [c for c in cities if c.get('enabled') and c['id'] not in skip]
    if not ok:
        return None
    last = {}  # id -> последняя дата показа
    for d, cid in history:
        day = dt.date.fromisoformat(d)
        if cid not in last or day > last[cid]:
            last[cid] = day
    start = today.toordinal() % len(ok)
    for i in range(len(ok)):
        c = ok[(start + i) % len(ok)]
        if c['id'] not in last or (today - last[c['id']]).days >= NO_REPEAT_DAYS:
            return c
    # все показывали недавно: берём того, кого не было дольше всех (при равенстве — по кругу)
    order = [ok[(start + i) % len(ok)] for i in range(len(ok))]
    return min(order, key=lambda c: last.get(c['id'], dt.date.min))


def first_sentence(text):
    text = ' '.join((text or '').split())
    m = re.search(r'[.!?](\s|$)', text)
    return text[:m.end()].strip() if m else text


def local_hm(meta, now_utc):
    """Местное время города по смещению utc из index.json — запасной вариант, если часы на странице не готовы."""
    t = now_utc + dt.timedelta(hours=meta.get('utc', 3))
    return t.strftime('%H:%M')


def caption_day(meta, scraped, now_utc=None):
    """Подпись к кадру: официальное название города, время, погода, первое предложение описания, ссылка."""
    scraped = scraped or {}
    clock = (scraped.get('clock') or '').strip()
    if not HM.match(clock):
        clock = local_hm(meta, now_utc or dt.datetime.now(dt.timezone.utc).replace(tzinfo=None))
    head = f"Окно дня. {meta['name']}, {clock}."
    wx = ' '.join((scraped.get('wx') or '').split())
    desc = first_sentence(meta.get('description', ''))
    mid = (f'Сейчас {wx}. ' if wx else '') + desc
    tail = f"Присесть у окна: lofi-goroda.ru/{meta['id']}/"
    room = CAPTION_MAX - len(head) - len(tail) - 4  # 4 — два разделителя «\n\n»
    if len(mid) > room:
        mid = mid[:max(room - 1, 0)].rstrip() + '…'
    return f"{head}\n\n{mid}\n\n{tail}" if mid else f"{head}\n\n{tail}"


def parse_changes(md):
    """CHANGES.md → [(дата, [пункты])] в порядке файла. Заголовки «## ГГГГ-ММ-ДД», пункты «- …»."""
    out = []
    for line in md.splitlines():
        m = re.match(r'^##\s+(\d{4}-\d{2}-\d{2})\s*$', line)
        if m:
            out.append((m.group(1), []))
        elif out and line.startswith('- '):
            out[-1][1].append(line[2:].strip())
        elif out and out[-1][1] and line.startswith((' ', '\t')) and line.strip():
            out[-1][1][-1] += ' ' + line.strip()  # продолжение длинного пункта
    return [(d, items) for d, items in out if items]


def newer_than(sections, last_date):
    """Разделы новее last_date; если ничего ещё не публиковали — только самый свежий."""
    if not last_date:
        return sections[:1]
    return [s for s in sections if s[0] > last_date]


def caption_news(sections):
    """«Тихие новости» из разделов (новые сверху); лишнее сверх 4096 знаков отбрасывается с конца."""
    head, tail = 'Тихие новости.\n\n', '\n\nlofi-goroda.ru'
    items = [it for _, its in sections for it in its]
    lines = []
    for it in items:
        cand = head + '\n'.join(lines + ['• ' + it]) + tail
        if len(cand) > MESSAGE_MAX:
            break
        lines.append('• ' + it)
    return head + '\n'.join(lines) + tail


def format_site_feedback(item):
    """Текст сообщения владельцу об отзыве с сайта (шлём без parse_mode — разметка пользователя не ломает).
    Вторая строка — город и контакт, если есть. Укладывается в лимит Telegram."""
    text = str(item.get('text', '')).strip()
    msg = f'Отзыв с сайта: {text}'
    extra = ' · '.join(p for p in (str(item.get('city', '') or '').strip(), str(item.get('from', '') or '').strip()) if p)
    if extra:
        msg += chr(10) + extra
    return msg[:MESSAGE_MAX]
