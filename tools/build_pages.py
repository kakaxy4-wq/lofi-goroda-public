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


def sub(pattern, repl, s):
    out, n = re.subn(pattern, repl, s, count=1)
    assert n == 1, pattern
    return out


for c in cities:
    if not c.get('enabled'):
        continue
    t, d, og = html.escape(c['title']), html.escape(c['description']), c['og']
    url = f"https://lofi-goroda.ru/{c['id']}/"
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
    os.makedirs(os.path.join(ROOT, c['id']), exist_ok=True)
    open(os.path.join(ROOT, c['id'], 'index.html'), 'w', encoding='utf-8').write(page)
    print('ok', c['id'])

# sitemap.xml: корень, /privacy/ и все включённые города
urls = ['https://lofi-goroda.ru/'] + [f"https://lofi-goroda.ru/{c['id']}/" for c in cities if c.get('enabled')] + ['https://lofi-goroda.ru/privacy/']
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sm += ''.join(f'  <url><loc>{u}</loc></url>\n' for u in urls) + '</urlset>\n'
open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8', newline='\n').write(sm)
print('ok sitemap.xml', len(urls), 'url')
