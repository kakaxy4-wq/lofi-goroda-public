"""Тесты bot/vkparse.py и общей части с tgparse (same_as_offered). Без сети."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'bot'))
import tgparse  # noqa: E402
import vkparse  # noqa: E402

with open(os.path.join(ROOT, 'tests/fixtures/vk_wall.json'), encoding='utf-8') as f:
    WALL = json.load(f)
with open(os.path.join(ROOT, 'site/cities/doroga/stops.json'), encoding='utf-8') as f:
    STOPS = json.load(f)


def test_parse_wall():
    posts = vkparse.parse_vk_wall(WALL)
    assert [p['id'] for p in posts] == [5011, 5012, 5014]  # репост 5013 пропущен, порядок по id
    by = {p['id']: p for p in posts}
    assert by[5012]['geo'] == {'lat': 52.033, 'lon': 113.501}
    assert by[5012]['ts'] == 1792000000 * 1000
    assert by[5011]['text'] == '' and by[5011]['geo'] is None
    assert by[5014]['geo'] == {'lat': 51.82, 'lon': 107.6}  # только place.latitude/longitude
    assert by[5012]['owner_id'] == -12345


def test_parse_garbage():
    assert vkparse.parse_vk_wall({}) == []
    assert vkparse.parse_vk_wall(None) == []
    assert vkparse.parse_vk_wall({'response': {'items': [None, {'id': 'x'}, {'date': 1}]}}) == []


def test_error_and_mask():
    assert vkparse.vk_error(WALL) is None
    assert vkparse.vk_error({'error': {'error_code': 5, 'error_msg': 'User authorization failed'}}) == (5, 'User authorization failed')
    s = vkparse.mask_key('GET https://api.vk.com/method/wall.get?domain=x&access_token=SECRET123&v=5.199')
    assert 'SECRET123' not in s and 'v=5.199' in s


def test_geo_to_stop():
    p = [x for x in vkparse.parse_vk_wall(WALL) if x['id'] == 5012][0]
    stop = tgparse.find_by_geo(p['geo'], STOPS, 2700) or tgparse.find_city(p["text"], STOPS, 2700)
    assert stop and stop['name'] == 'Чита'


def test_same_as_offered():
    chita = {'name': 'Чита', 'km': 2925}
    now = 10 ** 13
    assert tgparse.same_as_offered(chita, {'name': 'чита', 'ts': now - 3600_000}, now)
    assert not tgparse.same_as_offered(chita, {'name': 'Чита', 'ts': now - 3 * 86400_000}, now)
    assert not tgparse.same_as_offered(chita, {'name': 'Иркутск', 'ts': now}, now)
    assert not tgparse.same_as_offered(chita, None, now)
