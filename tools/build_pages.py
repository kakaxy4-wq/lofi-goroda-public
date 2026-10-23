"""Страницы городов: из site/index.html делает site/<id>/index.html со своими title, описанием,
превью и canonical — чтобы у каждого города был свой адрес и своя карточка в соцсетях.
Запуск: python tools/build_pages.py (перед выкладкой)."""
import html
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
tpl = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
cities = json.load(open(os.path.join(ROOT, 'cities', 'index.json'), encoding='utf-8'))


# Окно, которое живёт в корне: canonical — на корень, в sitemap — корень, страница пишется и в site/index.html.
# С 23.10.2026 корень — «Окно дня» (до того — Санкт-Петербург). site/index.html — одновременно шаблон для остальных
# страниц: подстановки ниже заменяют все поля, поэтому шаблон может быть страницей любого окна.
ROOT_CITY = 'okno-dnya'


def url_of(cid):
    return 'https://lofi-goroda.ru/' if cid == ROOT_CITY else f'https://lofi-goroda.ru/{cid}/'


def sub(pattern, repl, s):
    out, n = re.subn(pattern, repl, s, count=1)
    assert n == 1, pattern
    return out


for c in cities:
    if not c.get('enabled'):
        continue
    t, d, og = html.escape(c['title']), html.escape(c['description']), c['og']
    url = url_of(c['id'])
    page = tpl
    page = sub(r'<title>.*?</title>', f'<title>{t}</title>', page)
    page = sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{d}">', page)
    page = sub(r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{t}">', page)
    page = sub(r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{d}">', page)
    page = sub(r'<meta property="og:url" content=".*?">', f'<meta property="og:url" content="{url}">', page)
    page = sub(r'<meta property="og:image" content=".*?">', f'<meta property="og:image" content="https://lofi-goroda.ru/{og}">', page)
    if '<link rel="canonical"' in page:
        page = sub(r'<link rel="canonical" href=".*?">', f'<link rel="canonical" href="{url}">', page)
    else:
        page = page.replace('<link rel="manifest"', f'<link rel="canonical" href="{url}">\n<link rel="manifest"', 1)
    # шапка и плеер — сразу свой город, иначе при загрузке на секунду мелькает «Санкт-Петербург» из шаблона
    n = html.escape(c['name'])
    page = sub(r'<h1>.*?</h1>', f'<h1>{n}</h1>', page)
    page = sub(r'<span id="subtitle">.*?</span>', '<span id="subtitle"></span>', page)
    page = sub(r'id="npTitle">.*?</div>', f'id="npTitle">Радио {n}</div>', page)
    page = sub(r'<canvas id="scene" aria-label=".*?">', f'<canvas id="scene" aria-label="{n}: вид из окна">', page)
    # «что за окном»: описание города и ссылка на его историю — видимый текст для поиска
    page = sub(r'<span id="aboutText">.*?</span>', f'<span id="aboutText">{d}</span>', page)
    ng = html.escape(c.get('nameGen') or c['name'])
    page = sub(r'<a id="aboutLink" href=".*?">.*?</a>', f'<a id="aboutLink" href="{c["id"]}/o-gorode/">Всё об окне {ng} →</a>', page)
    ld = {'@context': 'https://schema.org', '@type': 'RadioStation', 'name': f'Радио {c["name"]}', 'alternateName': 'Лофи-города',
          'url': url, 'description': c['description'], 'image': f'https://lofi-goroda.ru/{og}', 'areaServed': c['name'], 'isAccessibleForFree': True}
    ld = json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')
    # разметка может быть и плотной (исходный шаблон), и с пробелами (json.dumps): главная теперь тоже собирается из шаблона
    page = sub(r'<script type="application/ld\+json">\{"@context":\s*"https://schema\.org",\s*"@type":\s*"RadioStation".*?</script>', lambda m: f'<script type="application/ld+json">{ld}</script>', page)
    if c['id'] == ROOT_CITY:  # главная: та же страница, но с разметкой WebSite
        open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8', newline=chr(10)).write(page)
    # WebSite — только на главной, у городов убираем
    page = sub(r'<script type="application/ld\+json">\{"@context":\s*"https://schema\.org",\s*"@type":\s*"WebSite".*?</script>\r?\n', '', page)
    os.makedirs(os.path.join(ROOT, c['id']), exist_ok=True)
    open(os.path.join(ROOT, c['id'], 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)
    print('ok', c['id'])

# 404: список всех включённых городов — между маркерами-комментариями в site/404.html
nf_path = os.path.join(ROOT, '404.html')
nf = open(nf_path, encoding='utf-8').read()
links = ' · '.join(f'<a href="/{c["id"]}/">{html.escape(c["name"])}</a>' for c in cities if c.get('enabled'))
nf = sub(r'<!-- cities:start -->[\s\S]*?<!-- cities:end -->',
         f'<!-- cities:start -->\n  <p class="nf-cities-title">Зато эти окна у нас светятся:</p>\n'
         f'  <nav class="nf-cities" aria-label="Список городов">{links}</nav>\n  <!-- cities:end -->', nf)
open(nf_path, 'w', encoding='utf-8', newline='\n').write(nf)
print('ok 404.html', sum(1 for c in cities if c.get('enabled')), 'cities')

# sitemap.xml: все включённые города (ROOT_CITY — адресом корня) и /privacy/.
# lastmod — дата последнего коммита в файлах, из которых собрана страница (без коммитов — сегодня).
import datetime
import subprocess
REPO = os.path.join(ROOT, '..')
_dates = {}


def gitdate(*paths):
    if paths not in _dates:
        try:
            out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', *paths], cwd=REPO, capture_output=True, text=True, timeout=20).stdout.strip()
        except Exception:
            out = ''
        _dates[paths] = out or datetime.date.today().isoformat()
    return _dates[paths]


ENGINE = ('site/engine', 'site/index.html', 'site/css')
lastmod = {url_of(c['id']): gitdate(f"site/cities/{c['id']}", 'site/cities/index.json', *ENGINE)
           for c in cities if c.get('enabled') and not c.get('hidden')}
lastmod['https://lofi-goroda.ru/'] = gitdate(f'site/cities/{ROOT_CITY}', 'site/cities/index.json', *ENGINE)  # корень, даже если окно скрыто из меню
lastmod['https://lofi-goroda.ru/privacy/'] = gitdate('site/privacy')
urls = list(lastmod)
# истории городов /<id>/o-gorode/ — статичные страницы для поиска
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_stories import build as build_stories
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'music'))
from add_bpm import run as add_bpm  # темп треков в плейлистах — для ночного эфира
add_bpm()
stories = build_stories()
for u in stories:
    lastmod[u] = gitdate('tools/stories_data.json', 'tools/build_stories.py', 'site/css/page.css')
urls += stories
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sm += ''.join(f'  <url><loc>{u}</loc><lastmod>{lastmod[u]}</lastmod></url>\n' for u in urls) + '</urlset>\n'
open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n').write(sm)
print('ok sitemap.xml', len(urls), 'url')
