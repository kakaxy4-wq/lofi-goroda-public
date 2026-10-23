"""Тесты bot/tgparse.py и bot/timelapse.py: разбор превью канала, поиск города в тексте, кадры таймлапса. Без сети."""
import datetime as dt
import json
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'bot'))
import tgparse  # noqa: E402
import timelapse  # noqa: E402

with open(os.path.join(ROOT, 'site/cities/doroga/stops.json'), encoding='utf-8') as f:
    STOPS = json.load(f)
with open(os.path.join(ROOT, 'tests/fixtures/tg_channel.html'), encoding='utf-8') as f:
    HTML = f.read()


def city(text, km):
    s = tgparse.find_city(text, STOPS, km)
    return s['name'] if s else None


# ---------- разбор HTML ----------
def test_parse_fixture():
    posts = tgparse.parse_channel_html(HTML)
    assert [p['id'] for p in posts] == [3443, 3444, 3450, 3455]
    for p in posts:
        assert p['ts'] and p['ts'] > 1.7e12
        assert p['text'] and '<' not in p['text'] and '&#' not in p['text']
        assert p['geo'] is None
    assert posts[1]['text'].startswith('☕')
    assert 'Доброе утро!' in posts[1]['text']
    assert posts[0]['ts'] == int(dt.datetime(2026, 10, 14, 4, 0, 48, tzinfo=dt.timezone.utc).timestamp() * 1000)


def test_parse_empty_and_junk():
    assert tgparse.parse_channel_html('') == []
    assert tgparse.parse_channel_html('<html>нет постов</html>') == []


def test_parse_geo_link_and_text():
    html = ('<div class="tgme_widget_message text_not_supported_wrap" data-post="Gruzin_and_Mars/10">'
            '<div class="tgme_widget_message_text js-message_text">Мы тут<br/>ночуем</div>'
            '<a href="https://yandex.ru/maps/?pt=113.5,52.03&amp;z=12">карта</a>'
            '<a class="date" href="x"><time datetime="2026-10-20T10:00:00+00:00"></time></a></div>'
            '<div class="tgme_widget_message" data-post="Gruzin_and_Mars/11">'
            '<div class="tgme_widget_message_text js-message_text">Точка: 52.0333, 113.5000</div></div>'
            '<div class="tgme_widget_message" data-post="Gruzin_and_Mars/12">'
            '<div class="tgme_widget_message_text js-message_text">см. <a href="https://www.google.com/maps?q=51.83,107.6">тут</a></div></div>')
    a, b, c = tgparse.parse_channel_html(html)
    assert a['text'] == 'Мы тут\nночуем'
    assert a['geo'] == {'lat': 52.03, 'lon': 113.5}      # Яндекс: долгота,широта
    assert b['geo'] == {'lat': 52.0333, 'lon': 113.5}
    assert c['geo'] == {'lat': 51.83, 'lon': 107.6}
    assert tgparse.find_by_geo(a['geo'], STOPS, 2900)['name'] == 'Чита'
    assert tgparse.find_by_geo(c['geo'], STOPS, 3400)['name'] == 'Улан-Удэ'


def test_geo_far_from_any_stop():
    assert tgparse.find_by_geo({'lat': 60.0, 'lon': 100.0}, STOPS, 3000) is None


# ---------- поиск города ----------
def test_forms():
    assert city('Добрались до Читы!', 2800) == 'Чита'
    assert city('ночуем в Улан-Удэ', 3500) == 'Улан-Удэ'
    assert city('ночуем в улан удэ', 3500) == 'Улан-Удэ'
    assert city('Хабаровск, привет', 600) == 'Хабаровск'
    assert city('ЕДЕМ В ЧИТЕ', 2800) == 'Чита'
    assert city('Выехали из Читы', 2925) == 'Чита'
    assert city('Проехали Читу', 2800) == 'Чита'
    assert city('встретились с Читой', 2800) == 'Чита'
    assert city('Приехали в Нижний Новгород', 8700) == 'Нижний Новгород'
    assert city('утро в Нижнем Новгороде', 8700) == 'Нижний Новгород'
    assert city('Ёлки: в Тюмени дождь', 7000) == 'Тюмень'
    assert city('Москву видно', 9000) == 'Москва'


def test_no_city():
    assert city('зима близко', 3000) is None
    assert city('Доброе утро! Пусть любимый напиток согреет', 3000) is None
    assert city('читаем книгу, читает вслух', 2800) is None   # «чит…» — не Чита
    assert city('', 3000) is None


def test_corridor_cuts_far_cities():
    assert city('Шутка про Читу', 7000) is None           # Чита далеко позади
    assert city('Мечтаем о Москве', 3000) is None         # Москва слишком далеко впереди
    assert city('Мечтаем о Москве', 8500) == 'Москва'
    assert city('вчера в Чите было холодно', 3100) == 'Чита'   # позади в пределах 300 км
    assert city('Красноярск', None) == 'Красноярск'           # без текущего км фильтра нет


def test_farthest_wins():
    assert city('Из Читы до Улан-Удэ ещё далеко', 2900) == 'Улан-Удэ'
    assert city('Улан-Удэ позади, впереди Иркутск и Чита', 3600) == 'Иркутск'


def test_is_new_point():
    chita = next(s for s in STOPS if s['name'] == 'Чита')
    assert tgparse.is_new_point(chita, None)
    assert not tgparse.is_new_point(chita, {'km': 2925, 'label': 'Чита'})
    assert not tgparse.is_new_point(chita, {'km': 2930, 'label': 'около Читы'})
    assert tgparse.is_new_point(chita, {'km': 2500, 'label': 'Чернышевск'})
    assert not tgparse.is_new_point(None, None)


def test_preview():
    assert tgparse.preview('a  b\nc') == 'a b c'
    assert len(tgparse.preview('x' * 500)) == 121


# ---------- таймлапс ----------
def test_should_shoot():
    now = 1_000_000_000_000
    assert timelapse.should_shoot({'status': 'run'}, now)
    assert timelapse.should_shoot({'status': 'pause'}, now)
    assert not timelapse.should_shoot({'status': 'done'}, now)
    assert not timelapse.should_shoot({'status': 'soon', 'start': now + 2 * 3600000}, now)
    assert timelapse.should_shoot({'status': 'soon', 'start': now + 1800000}, now)
    assert not timelapse.should_shoot(None, now)


def test_frames_save_prune_stats():
    t = dt.datetime(2026, 10, 19, 8, 10, tzinfo=dt.timezone.utc)
    assert timelapse.frame_name(t) == '20261019-0810.jpg'
    assert timelapse.frame_name(t.astimezone(dt.timezone(dt.timedelta(hours=10)))) == '20261019-0810.jpg'
    with tempfile.TemporaryDirectory() as d:
        sub = os.path.join(d, 'timelapse')
        assert timelapse.stats(sub)['count'] == 0
        for i in range(5):
            timelapse.save(sub, b'x' * 100, t + dt.timedelta(minutes=10 * i))
        s = timelapse.stats(sub)
        assert s['count'] == 5 and s['bytes'] == 500
        assert s['first'] == '20261019-0810.jpg' and s['last'] == '20261019-0850.jpg'
        open(os.path.join(sub, 'notes.txt'), 'w').close()
        timelapse.prune(sub, keep=2)
        assert timelapse.frames(sub) == ['20261019-0840.jpg', '20261019-0850.jpg']
        assert 'Кадров таймлапса: 2' in timelapse.format_stats(timelapse.stats(sub))
        assert not [f for f in os.listdir(sub) if f.endswith('.tmp')]
    assert 'пока нет' in timelapse.format_stats({'count': 0})
    assert timelapse.pretty_name('20261019-0810.png') == '19.10 08:10 UTC'
