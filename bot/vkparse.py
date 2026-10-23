"""Разбор ответа VK API wall.get (стена блогера) — чистые функции, без сети.

  parse_vk_wall(data) → [{'id':int, 'ts':<мс UTC>, 'text':str, 'geo':{'lat','lon'}|None, 'owner_id':int|None}] по возрастанию id
  vk_error(data) → (код, сообщение) | None
  mask_key(s) → строка с замаскированным ключом (для логов)

Репосты (copy_history) пропускаем. Всё, что пришло из VK, — недоверенные данные.
"""
import re

_KEY = re.compile(r'(access_token=)[^&\s]+', re.I)


def mask_key(s):
    return _KEY.sub(r'\1***', str(s))


def vk_error(data):
    if isinstance(data, dict) and isinstance(data.get('error'), dict):
        e = data['error']
        try:
            code = int(e.get('error_code') or 0)
        except (TypeError, ValueError):
            code = 0
        return code, mask_key(str(e.get('error_msg', ''))[:200])
    return None


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _geo(g):
    if not isinstance(g, dict):
        return None
    lat = lon = None
    c = g.get('coordinates')
    if isinstance(c, str):
        parts = c.replace(',', ' ').split()
        if len(parts) == 2:
            lat, lon = _num(parts[0]), _num(parts[1])
    if lat is None:
        pl = g.get('place')
        if isinstance(pl, dict):
            lat, lon = _num(pl.get('latitude')), _num(pl.get('longitude'))
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
        return None
    return {'lat': lat, 'lon': lon}


def parse_vk_wall(data):
    items = (data.get('response') or {}).get('items') if isinstance(data, dict) else None
    out = []
    for it in items or []:
        if not isinstance(it, dict) or it.get('copy_history'):
            continue
        try:
            pid, date = int(it['id']), int(it.get('date') or 0)
        except (KeyError, TypeError, ValueError):
            continue
        owner = it.get('owner_id')
        out.append({'id': pid, 'ts': date * 1000, 'text': str(it.get('text') or '').strip(), 'geo': _geo(it.get('geo')),
                    'owner_id': owner if isinstance(owner, int) else None})
    out.sort(key=lambda x: x['id'])
    return out
