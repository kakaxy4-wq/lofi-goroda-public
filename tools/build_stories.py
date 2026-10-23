"""Истории городов: статичная страница /<id>/o-gorode/ для каждого окна — что видно из окна,
места рядом, звуки, музыка эфира. Текст — из карточек мест сайта (tools/stories_data.json),
новых фактов здесь нет. Нужна поиску (страница читается без JavaScript) и тем, кто хочет
узнать о городе больше. Вызывается из build_pages.py; данные обновляет выгрузка из браузера:

  в странице сайта: const C = await (await fetch('/cities/index.json')).json(); … (см. docs/STATE.md)
"""
import html
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stories_data.json')
SLUG = 'o-gorode'
e = html.escape


def plain(s):
    return re.sub(r'<[^>]+>', '', s)


CSS = """
@font-face { font-family: 'Title'; src: url(/fonts/caveat-cyr.woff2) format('woff2'); font-weight: 700; unicode-range: U+0400-045F; font-display: swap; }
@font-face { font-family: 'Title'; src: url(/fonts/caveat-lat.woff2) format('woff2'); font-weight: 700; unicode-range: U+0000-00FF, U+2000-206F; font-display: swap; }
@font-face { font-family: 'Lofi'; src: url(/fonts/pangolin-cyr.woff2) format('woff2'); unicode-range: U+0400-045F; font-display: swap; }
@font-face { font-family: 'Lofi'; src: url(/fonts/pangolin-lat.woff2) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; font-display: swap; }
:root { --bg: #140e12; --panel: #241a1c; --panel-2: #312224; --ink: #f3e6c8; --muted: #bfae96; --accent: #f2b94a; --accent-ink: #2a1606; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.6 Lofi, system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
a { color: var(--accent); }
.brand { font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
h1 { font: 700 56px/1.05 Title, Lofi, sans-serif; margin: 8px 0 4px; color: #ffe2b0; }
.sub { color: var(--muted); margin: 0 0 16px; }
.hero { display: block; width: 100%; height: auto; image-rendering: pixelated; margin: 8px 0 16px; box-shadow: 0 0 0 3px #0c0809; }
.cta { display: inline-block; margin: 4px 0 20px; padding: 10px 18px; background: var(--accent); color: var(--accent-ink); text-decoration: none; font-size: 20px; }
.cta:hover, .cta:focus-visible { background: #ffd27a; outline: none; }
h2 { font: 700 34px/1.2 Title, Lofi, sans-serif; color: #ffe2b0; margin: 32px 0 8px; }
.place { background: var(--panel); padding: 12px 16px; margin: 10px 0; }
.place h3 { margin: 0 0 4px; font-size: 20px; }
.place p { margin: 0; color: var(--ink); }
.tag { font-size: 13px; color: var(--muted); margin-left: 8px; }
ul.sounds, ol.tracks { padding-left: 22px; }
ul.sounds li span, .muted { color: var(--muted); }
ol.tracks { columns: 2; column-gap: 28px; }
@media (max-width: 560px) { ol.tracks { columns: 1; } h1 { font-size: 44px; } }
nav.cities { display: flex; flex-wrap: wrap; gap: 8px; }
nav.cities a { padding: 4px 10px; background: var(--panel-2); color: var(--ink); text-decoration: none; }
nav.cities a:hover { color: var(--accent); }
footer { margin-top: 40px; color: var(--muted); font-size: 14px; }
"""


def place_html(p):
    label = ('скоро: ' + p['soon']) if p['soon'].startswith('Сцена') else p['soon']  # будущие сцены — так и подписываем
    soon = f' <span class="tag">· {e(label)}</span>' if p['soon'] else ''
    return f'<div class="place"><h3>{e(p["name"])}{soon}</h3><p>{e(p["fact"])}</p></div>'


def page(c, cities, borrowed):
    url = f"https://lofi-goroda.ru/{c['id']}/{SLUG}/"
    win = f"/{c['id']}/"
    title = f"{c['name']}: что видно из окна · Лофи-города"
    in_scene = [p for p in c['places'] if p['inScene']]
    near = [p for p in c['places'] if not p['inScene']]
    desc = f"{c['name']} из окна лофи-радио: " + ', '.join(p['name'] for p in in_scene[:5]) + '. Реальное время и погода, эфир и звуки города.'
    places = lambda ps: ''.join(place_html(p) for p in ps)
    intro = (f"<p>{len(c['tracks'])} треков эфира:</p>" if c['radioName'] in plain(c['about'])  # про эфир уже сказано в описании
             else f"<p>{e(c['radioName'])} — общий эфир: все слушатели слышат одно и то же в один момент. Играют {len(c['tracks'])} лофи-треков, а между ними — живые вставки, которые сочиняются прямо в браузере.</p>")
    tracks = ''.join(f'<li>{e(t)}</li>' for t in c['tracks'])
    music = (f"<p>Своей музыки у {e(c['nameGen'])} пока нет — в эфире треки {e(borrowed)}.</p>" if borrowed
             else intro + f'<ol class="tracks">{tracks}</ol>')
    others = ''.join(f"<a href=\"/{o['id']}/{SLUG}/\">{e(o['name'])}</a>" for o in cities if o['id'] != c['id'])
    secrets = f"<p>В окне {e(c['nameGen'])} спрятано секретов: {c['secrets']}. Они появляются в своё время и погоду — найдите их сами.</p>" if c['secrets'] else ''
    # свой текст страницы (Марсоход): поле custom_html заменяет общие разделы целиком
    body = c.get('custom_html') or f"""{c['about']}
<h2>Что видно из окна</h2>
{places(in_scene)}
{f'<h2>Рядом, но не в кадре</h2>{places(near)}' if near else ''}
<h2>Звуки</h2>
<p>Звуки синтезируются в браузере и следуют за настоящей погодой и временем {e(c['nameGen'])} (UTC+{c['utc']}).</p>
<ul class="sounds">{''.join(f"<li>{e(s['name'])} <span>— {e(s['hint'])}</span></li>" for s in c['sounds'])}</ul>
<h2>Музыка эфира</h2>
{music}
{f'<h2>Секреты</h2>{secrets}' if secrets else ''}"""
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://lofi-goroda.ru/{c['og']}">
<link rel="icon" href="/favicon.ico">
<style>{CSS}</style>
</head>
<body>
<main>
<a class="brand" href="/">Лофи-города</a>
<h1>{e(c['name'])}</h1>
<p class="sub">{e(c['subtitle'])}</p>
<a href="{win}"><img class="hero" src="/{c['og']}" width="1200" height="630" alt="{e(c['name'])}: вид из окна — {e(', '.join(p['name'] for p in in_scene[:4]))}"></a>
<a class="cta" href="{win}">▶ Открыть окно {e(c['nameGen'])}</a>
{body}
<p><a class="cta" href="{win}">▶ Открыть окно {e(c['nameGen'])}</a></p>
<h2>Другие окна</h2>
<nav class="cities">{others}</nav>
<footer>Лофи-города — живые окна в города России, бесплатно и без рекламы. <a href="/privacy/">Конфиденциальность</a></footer>
</main>
</body>
</html>
"""


def build():
    data = json.load(open(DATA, encoding='utf-8'))
    by_tracks = {}
    for c in data:
        if c['tracks']:
            by_tracks.setdefault(tuple(c['tracks']), []).append(c)
    urls = []
    for c in data:
        owners = by_tracks.get(tuple(c['tracks']), [])
        # чужой эфир: тот же плейлист, что у другого города, у которого он «свой» (первый в списке городов)
        borrowed = next((o['nameGen'] for o in owners if o['id'] != c['id'] and o is owners[0]), '') if len(owners) > 1 else ''
        d = os.path.join(ROOT, c['id'], SLUG)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page(c, data, borrowed))
        urls.append(f"https://lofi-goroda.ru/{c['id']}/{SLUG}/")
    return urls


if __name__ == '__main__':
    print('ok', len(build()), 'историй')
