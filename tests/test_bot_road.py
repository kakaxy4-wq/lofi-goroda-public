"""Тесты bot/road.py: разбор /road и тексты ответов. Без Telegram и сети. Остановки — фикстура из таблицы ТЗ."""
import datetime as dt
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'bot'))
import road  # noqa: E402


def S(km, name, gen, loc, big=False):
    return {'km': km, 'name': name, 'gen': gen, 'loc': loc, 'big': big}


STOPS = [
    S(0, 'Владивосток', 'Владивостока', 'во Владивостоке', True),
    S(100, 'Уссурийск', 'Уссурийска', 'в Уссурийске'),
    S(760, 'Хабаровск', 'Хабаровска', 'в Хабаровске', True),
    S(1510, 'Белогорск', 'Белогорска', 'в Белогорске', True),
    S(2560, 'Чернышевск', 'Чернышевска', 'в Чернышевске'),
    S(2925, 'Чита', 'Читы', 'в Чите', True),
    S(3570, 'Улан-Удэ', 'Улан-Удэ', 'в Улан-Удэ', True),
    S(3930, 'Култук', 'Култука', 'в Култуке'),
    S(4020, 'Иркутск', 'Иркутска', 'в Иркутске', True),
    S(7165, 'Тюмень', 'Тюмени', 'в Тюмени', True),
    S(8475, 'Казань', 'Казани', 'в Казани', True),
    S(8875, 'Нижний Новгород', 'Нижнего Новгорода', 'в Нижнем Новгороде', True),
    S(9280, 'Москва', 'Москвы', 'в Москве', True),
]
P = lambda a: road.parse_road(a, STOPS)
NOW = 1792400000000  # любой момент для текстов


def test_empty_is_state():
    assert P('') == {'op': 'state'}
    assert P(None) == {'op': 'state'}
    assert P('   ') == {'op': 'state'}


def test_city_forms():
    for q in ('Чита', 'чита', 'ЧИТА', 'читы', 'в Чите', 'В ЧИТЕ', 'чит', 'около Читы'):
        assert P(q) == {'op': 'cp', 'km': 2925, 'label': 'Чита'}, q


def test_city_multiword_and_hyphen_and_yo():
    assert P('Нижний Новгород')['km'] == 8875
    assert P('в Нижнем Новгороде')['km'] == 8875
    assert P('нижний')['km'] == 8875
    assert P('Улан-Удэ')['km'] == 3570
    assert P('в Улан-Удэ')['km'] == 3570
    assert P('Тюмени')['km'] == 7165
    assert P('в Тюмени')['km'] == 7165


def test_exact_beats_prefix_and_ambiguous_asks():
    stops = STOPS + [S(9000, 'Читинск', 'Читинска', 'в Читинске')]
    assert road.parse_road('чита', stops)['km'] == 2925  # точное совпадение важнее начала слова
    r = road.parse_road('чит', stops)
    assert r['op'] == 'error' and 'Чита' in r['text'] and 'Читинск' in r['text']


def test_number_km_label_nearest_city():
    assert P('6200') == {'op': 'cp', 'km': 6200, 'label': 'около Тюмени'}
    r = P('3000')
    assert r == {'op': 'cp', 'km': 3000, 'label': 'около Читы'}
    assert P('3000 км')['km'] == 3000
    assert P('0')['km'] == 0 and P('9280')['km'] == 9280


def test_number_out_of_range():
    assert P('9281')['op'] == 'error'
    assert P('99999')['op'] == 'error'


def test_city_with_shift():
    r = P('Чита +120')
    assert r == {'op': 'cp', 'km': 3045, 'label': 'около Читы'}
    assert P('Чита+120')['km'] == 3045
    assert P('в Чите -50')['km'] == 2875
    assert P('чита + 120 км')['km'] == 3045
    assert P('Улан-Удэ +10')['km'] == 3580  # дефис в названии не путается со сдвигом
    assert P('Владивосток -5')['op'] == 'error'  # левее нуля
    assert P('Москва +1')['op'] == 'error'  # правее финиша


def test_status_words():
    assert P('пауза') == {'op': 'status', 'status': 'pause'}
    assert P('Стоп') == {'op': 'status', 'status': 'pause'}
    assert P('едем') == {'op': 'status', 'status': 'run'}
    assert P('run') == {'op': 'status', 'status': 'run'}
    assert P('финиш') == {'op': 'status', 'status': 'done'}
    assert P('done') == {'op': 'status', 'status': 'done'}


def test_undo():
    assert P('отмена') == {'op': 'undo'}
    assert P('undo') == {'op': 'undo'}


def test_start_vladivostok_time():
    r = P('старт 19.10 08:00')
    assert r['op'] == 'start'
    assert r['ts'] == 1792360800000  # 19.10.2026 08:00 UTC+10 = 18.10 22:00 UTC
    now = dt.datetime(2026, 10, 16, tzinfo=dt.timezone.utc)
    assert road.parse_road('старт 20.10 09:30', STOPS, now)['ts'] == 1792360800000 + (25 * 60 + 30) * 60000
    assert road.parse_road('старт 19.10.2026 08:00', STOPS)['ts'] == 1792360800000
    assert road.parse_road('старт 19.10', STOPS, now)['ts'] == 1792360800000  # время по умолчанию 08:00


def test_start_errors():
    for bad in ('старт', 'старт вчера', 'старт 31.02 08:00', 'старт 19.10 25:00'):
        assert P(bad)['op'] == 'error', bad


def test_garbage_is_clear_error():
    for bad in ('абракадабра', 'ч', '??', 'Чита ааа', 'ха'):
        r = P(bad)
        assert r['op'] == 'error' and '/road' in r['text'], bad


def test_section_between_big_cities():
    assert road.section(3100, STOPS) == 'между Читой и Улан-Удэ'
    assert road.section(2925, STOPS) == 'между Читой и Улан-Удэ'
    assert road.section(3569, STOPS) == 'между Улан-Удэ и Иркутском'  # км округляется до 10, как в GET: 3570 = Улан-Удэ
    assert road.section(50, STOPS) == 'между Владивостоком и Хабаровском'
    assert road.section(8700, STOPS) == 'между Казанью и Нижним Новгородом'
    assert road.section(9280, STOPS) == 'в Москве'


def test_instrumental_all_big():
    want = {'Владивосток': 'Владивостоком', 'Хабаровск': 'Хабаровском', 'Белогорск': 'Белогорском', 'Чита': 'Читой',
            'Улан-Удэ': 'Улан-Удэ', 'Иркутск': 'Иркутском', 'Тюмень': 'Тюменью', 'Казань': 'Казанью',
            'Нижний Новгород': 'Нижним Новгородом', 'Москва': 'Москвой', 'Красноярск': 'Красноярском',
            'Новосибирск': 'Новосибирском', 'Омск': 'Омском', 'Екатеринбург': 'Екатеринбургом', 'Владимир': 'Владимиром'}
    for name, w in want.items():
        assert road.ins({'name': name}) == w, name
    assert road.ins({'name': 'X', 'ins': 'Игреком'}) == 'Игреком'


STATE = {'status': 'run', 'start': 1792360800000, 'updated': NOW,
         'cps': [{'km': 0, 'ts': 1792360800000, 'label': 'Владивосток'},
                 {'km': 2930, 'ts': NOW - 3 * 3600000 - 1000, 'label': 'Чита'}]}


def test_format_state():
    t = road.format_state(STATE, STOPS, NOW)
    assert 'в пути' in t and 'Чита' in t and '2930' in t and '3 ч назад' in t
    assert 'На сайте: между Читой и Улан-Удэ.' in t and t.endswith('https://lofi-goroda.ru/doroga/')


def test_format_state_soon_shows_start_in_vladivostok():
    st = {'status': 'soon', 'start': 1792360800000, 'updated': 0,
          'cps': [{'km': 0, 'ts': 1792360800000, 'label': 'Владивосток'}]}
    t = road.format_state(st, STOPS, NOW)
    assert 'ждём старта' in t and '19.10 08:00' in t


def test_format_done():
    t = road.format_done({'op': 'cp'}, STATE, STOPS, NOW)
    assert t.startswith('Отметил: Чита, ~2930 км.') and 'На сайте: между Читой и Улан-Удэ.' in t
    assert 'на паузе' in road.format_done({'op': 'status'}, {**STATE, 'status': 'pause'}, STOPS, NOW)
    assert 'Старт перенесён: 19.10 08:00' in road.format_done({'op': 'start'}, STATE, STOPS, NOW)
    assert 'Убрал' in road.format_done({'op': 'undo'}, STATE, STOPS, NOW)


def test_label_empty_falls_back_to_nearest_city():
    st = {**STATE, 'cps': [{'km': 3000, 'ts': NOW, 'label': ''}]}
    assert 'около Читы' in road.format_state(st, STOPS, NOW)


def test_reminder_due():
    old = {**STATE, 'cps': [{'km': 2930, 'ts': NOW - 21 * 3600000, 'label': 'Чита'}]}
    assert road.reminder_due(old, NOW, 0)
    assert not road.reminder_due(old, NOW, NOW - 3600000)  # уже напоминали час назад
    assert road.reminder_due(old, NOW, NOW - 25 * 3600000)
    fresh = {**STATE, 'cps': [{'km': 2930, 'ts': NOW - 19 * 3600000, 'label': 'Чита'}]}
    assert not road.reminder_due(fresh, NOW, 0)
    assert not road.reminder_due({**old, 'status': 'pause'}, NOW, 0)
    assert not road.reminder_due({**old, 'status': 'soon'}, NOW, 0)
    assert not road.reminder_due(None, NOW, 0)
