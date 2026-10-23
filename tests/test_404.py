"""404-страница: список городов между маркерами соответствует site/cities/index.json, скрипт подсказки
на месте, инлайн-скриптов нет (CSP script-src 'self'). После правки index.json нужно снова запустить
py -3 tools/build_pages.py — тест поймает рассинхрон. Запуск: py -3 -m pytest tests/test_404.py"""
import json
import os
import re

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')


def _read(*path):
    with open(os.path.join(SITE, *path), encoding='utf-8') as f:
        return f.read()


def _enabled():
    with open(os.path.join(SITE, 'cities', 'index.json'), encoding='utf-8') as f:
        return [c for c in json.load(f) if c.get('enabled')]


def test_markers_exist_once():
    nf = _read('404.html')
    assert len(re.findall(r'<!-- cities:start -->', nf)) == 1
    assert len(re.findall(r'<!-- cities:end -->', nf)) == 1


def test_list_matches_registry():
    nf = _read('404.html')
    block = re.search(r'<!-- cities:start -->(.*?)<!-- cities:end -->', nf, re.S).group(1)
    enabled = _enabled()
    assert len(re.findall(r'<a href="/', block)) == len(enabled), 'число ссылок ≠ числу включённых городов'
    for c in enabled:
        assert f'<a href="/{c["id"]}/">{c["name"]}</a>' in block, f'нет ссылки на {c["id"]}'


def test_no_inline_scripts():
    for m in re.findall(r'<script\b[^>]*>', _read('404.html')):
        assert 'src=' in m, f'инлайн-скрипт запрещён CSP: {m}'


def test_hint_script_wired():
    nf = _read('404.html')
    assert 'js/404.js' in nf, 'скрипт подсказки не подключён'
    assert 'id="hint"' in nf, 'нет контейнера подсказки'
    js = _read('js', '404.js')
    assert 'cities/index.json' in js, 'подсказка берёт города не из реестра'
    assert 'innerHTML' not in js and 'document.write' not in js, 'адрес из pathname — только через textContent'
    # популярные сокращения должны узнаваться (ключ в ALIAS — с кавычками или без)
    for alias in ('spb', 'peterburg', 'sankt-peterburg', 'екб', 'питер'):
        assert re.search(rf"['\"]?{re.escape(alias)}['\"]?\s*:", js), f'нет псевдонима {alias}'
