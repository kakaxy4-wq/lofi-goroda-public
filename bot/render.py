"""Кадр окна: Chromium открывает страницу города в режиме ?obs, ждёт сцену и снимает PNG.

Браузер запускается на каждый кадр и закрывается (память). Подпись берём с той же страницы.
"""
import asyncio
import base64
import json

from playwright.async_api import async_playwright

W, H = 1280, 720
SETTLE = 6        # секунд на погоду и сцену
TIMEOUT = 40      # секунд на весь кадр


class RenderError(Exception):
    """Сообщение понятно владельцу."""


async def _shot(site_url, city_id, hm, raw=False, road_state=None):
    url = f'{site_url.rstrip("/")}/{city_id}/?obs' + (f'&t={hm}' if hm else '')
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])
        try:
            page = await browser.new_page(viewport={'width': W, 'height': H})
            try:  # живой слой сайта не трогаем: кадр не должен попадать в счётчик «сейчас слушают»
                await page.route_web_socket('**/live**', lambda ws: None)
            except Exception:
                pass
            if road_state is not None:  # у бота SITE_URL — голый nginx без /live: отдаём странице настоящее состояние поездки, иначе кадр «ждём старта»
                async def _road(route):
                    await route.fulfill(status=200, content_type='application/json', body=json.dumps(road_state))
                await page.route('**/live/road', _road)
            resp = await page.goto(url, wait_until='load')
            if resp is None or resp.status >= 400:
                raise RenderError(f'Страница {url} ответила {resp.status if resp else "ничем"}.')
            await page.wait_for_timeout(SETTLE * 1000)
            # своя ли это страница и отрисовалась ли: без сцены и названия города кадр не отправляем (было: белый кадр чужого сайта)
            ok = await page.evaluate("() => !!document.querySelector('canvas#scene') && !!document.querySelector('h1')?.textContent.trim()")
            if not ok:
                raise RenderError(f'Страница {url} не похожа на окно Лофи-городов (нет сцены или названия) — кадр не снят.')
            # открытка сайта 1200×630 (город крупно, время, погода — как кнопка «другу»); нет хука — простой снимок экрана
            data = None if raw else await page.evaluate('async () => window.__lofiPostcard ? await window.__lofiPostcard() : null')
            png = base64.b64decode(data.split(',', 1)[1]) if data else await (page.screenshot(type='jpeg', quality=85) if raw else page.screenshot(type='png'))  # кадры таймлапса — JPEG: тысячи штук, диск не резиновый
            scraped = await page.evaluate('''() => {
                const t = (s) => (document.querySelector(s)?.textContent || '').trim();
                return {city: t('h1'), clock: t('#clock'), wx: t('#wx'), subtitle: t('#subtitle')};
            }''')
            return png, scraped
        finally:
            await browser.close()


async def render(site_url, city_id, hm=None, raw=False, road_state=None):
    """→ (png в байтах, {'city','clock','wx','subtitle'}). При сбое — RenderError с понятным текстом.
    raw=True — снимок всего окна 1280×720 (JPEG) вместо открытки (кадры таймлапса); road_state — ответ /live/road для страницы «Дорога»."""
    try:
        return await asyncio.wait_for(_shot(site_url, city_id, hm, raw, road_state), TIMEOUT)
    except RenderError:
        raise
    except asyncio.TimeoutError:
        raise RenderError(f'Кадр {city_id} не снялся за {TIMEOUT} с.')
    except Exception as e:
        raise RenderError(f'Не получилось снять кадр {city_id}: {type(e).__name__}: {str(e)[:200]}')
