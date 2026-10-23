"""Тесты bot/content.py: выбор города, подпись, разбор CHANGES.md, длины. Без Telegram и браузера."""
import datetime as dt
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'bot'))
import content  # noqa: E402

with open(os.path.join(ROOT, 'site', 'cities', 'index.json'), encoding='utf-8') as f:
    CITIES = json.load(f)
ENABLED = [c for c in CITIES if c.get('enabled')]
START = dt.date(2026, 10, 15)


def test_pick_city_no_repeat_14_days():
    history, picked = [], []
    for i in range(60):
        day = START + dt.timedelta(days=i)
        c = content.pick_city(CITIES, history, day)
        assert c['enabled']
        picked.append(c['id'])
        history.append((day.isoformat(), c['id']))
    assert len(ENABLED) > 14
    for i, cid in enumerate(picked):
        assert cid not in picked[max(0, i - 14):i], (i, cid)
    assert len(set(picked[:len(ENABLED)])) == len(ENABLED)  # за круг побывали все


def test_pick_city_deterministic_and_skip():
    a = content.pick_city(CITIES, [], START)
    assert a == content.pick_city(CITIES, [], START)
    b = content.pick_city(CITIES, [], START, skip={a['id']})
    assert b['id'] != a['id']
    assert content.pick_city([{'id': 'x', 'enabled': False}], [], START) is None


def test_pick_city_disabled_never_chosen():
    cities = [{'id': 'a', 'enabled': False}, {'id': 'b', 'enabled': True}]
    for i in range(5):
        assert content.pick_city(cities, [], START + dt.timedelta(days=i))['id'] == 'b'


def test_pick_city_all_recent_takes_oldest():
    cities = [{'id': 'a', 'enabled': True}, {'id': 'b', 'enabled': True}]
    hist = [('2026-10-10', 'a'), ('2026-10-12', 'b')]
    assert content.pick_city(cities, hist, START)['id'] == 'a'


def test_caption_day():
    kazan = next(c for c in CITIES if c['id'] == 'kazan')
    cap = content.caption_day(kazan, {'clock': '21:05', 'wx': '+8° ясно'})
    assert cap.startswith('Окно дня. Казань, 21:05.\n\nСейчас +8° ясно. Лофи-радио Казани')
    assert cap.endswith('Присесть у окна: lofi-goroda.ru/kazan/')
    assert 'Бесплатно' not in cap  # только первое предложение
    assert len(cap) <= 1024


def test_caption_day_official_names_and_limit():
    for c in ENABLED:
        cap = content.caption_day(c, {'clock': '07:30', 'wx': '-12° снег'})
        assert c['name'] in cap and len(cap) <= 1024
    spb = next(c for c in CITIES if c['id'] == 'piter')
    assert 'Санкт-Петербург, ' in content.caption_day(spb, {'clock': '12:00'})
    long = dict(spb, description='Очень длинно. ' * 0 + 'А' * 3000)
    assert len(content.caption_day(long, {'clock': '12:00', 'wx': 'x'})) <= 1024


def test_caption_day_clock_fallback():
    kazan = next(c for c in CITIES if c['id'] == 'kazan')
    cap = content.caption_day(kazan, {'clock': '--:--', 'wx': ''}, now_utc=dt.datetime(2026, 10, 15, 18, 0))
    assert 'Казань, 21:00.' in cap and 'Сейчас' not in cap


MD = """# Что нового

Пояснение.

## 2026-10-15
- Раз.
- Два
  продолжение.

## 2026-10-12
- Три.

## 2026-10-01
Пусто без пунктов.
"""


def test_parse_changes():
    s = content.parse_changes(MD)
    assert s == [('2026-10-15', ['Раз.', 'Два продолжение.']), ('2026-10-12', ['Три.'])]


def test_parse_real_changes_file():
    with open(os.path.join(ROOT, 'docs', 'CHANGES.md'), encoding='utf-8') as f:
        s = content.parse_changes(f.read())
    # свежий раздел сверху: дата ГГГГ-ММ-ДД, пункты есть, разделы по убыванию дат (не привязано к конкретному релизу)
    assert s and all(len(d) == 10 and d[4] == '-' and items for d, items in s)
    assert [d for d, _ in s] == sorted((d for d, _ in s), reverse=True)


def test_newer_than_and_caption_news():
    s = content.parse_changes(MD)
    assert content.newer_than(s, '2026-10-12') == [s[0]]
    assert content.newer_than(s, '2026-10-15') == []
    assert content.newer_than(s, '') == [s[0]]
    cap = content.caption_news(s)
    assert cap == 'Тихие новости.\n\n• Раз.\n• Два продолжение.\n• Три.\n\nlofi-goroda.ru'


def test_caption_news_limit():
    many = [('2026-10-15', [f'Пункт номер {i} ' + 'я' * 100 for i in range(200)])]
    cap = content.caption_news(many)
    assert len(cap) <= 4096 and cap.startswith('Тихие новости.') and cap.endswith('lofi-goroda.ru')


def test_format_site_feedback():
    assert content.format_site_feedback({'text': 'Привет <b>', 'city': '', 'from': ''}) == 'Отзыв с сайта: Привет <b>'
    m = content.format_site_feedback({'text': 'Идея', 'city': 'Казань', 'from': '@ivan'})
    assert m == 'Отзыв с сайта: Идея\nКазань · @ivan'
    assert content.format_site_feedback({'text': 'x', 'from': 'сайт'}).endswith('\nсайт')
    assert len(content.format_site_feedback({'text': 'я' * 9000})) <= content.MESSAGE_MAX
