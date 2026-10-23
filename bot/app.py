"""Бот @oknodnya_bot: «Окно дня» и «Тихие новости» для канала @oknodnya, отзывы из личных сообщений.

aiogram 3, long polling. Секреты — только из окружения (bot.env на сервере). Запускать ровно один экземпляр
с этим токеном (второй даёт 409). Состояние — в SQLite на томе /data.
"""
import asyncio
import datetime as dt
import json
import logging
import os
import time
from zoneinfo import ZoneInfo

import aiohttp
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import (BotCommand, BotCommandScopeChat, BotCommandScopeDefault, CallbackQuery,
                           FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup, LinkPreviewOptions, MenuButtonWebApp, Message,
                           WebAppInfo)

import content
import road
import tgparse
import vkparse
import timelapse
from render import RenderError, render
from store import Store

log = logging.getLogger('bot')

BOT_TOKEN = os.environ['BOT_TOKEN']
OWNER_ID = int(os.environ['OWNER_ID'])
CHANNEL_ID = int(os.environ['CHANNEL_ID'])
BOT_KEY = os.environ.get('BOT_KEY', '')
SITE_URL = os.environ.get('SITE_URL', 'http://lofigoroda-web')
LIVE_URL = os.environ.get('LIVE_URL', 'http://lofigoroda-live:8766')
POST_TIME = os.environ.get('POST_TIME', '21:00')
TZ = ZoneInfo(os.environ.get('TZ_NAME', 'Europe/Moscow'))
DATA_DIR = os.environ.get('DATA_DIR', '/data')
CHANGES = os.environ.get('CHANGES_PATH', '/app/CHANGES.md')
CHANNEL_LINK = 'https://t.me/oknodnya'
WEBAPP_URL = os.environ.get('WEBAPP_URL', 'https://lofi-goroda.ru/?tg=1')  # сайт как Mini App (initData не проверяем: от имени пользователя ничего не делаем)
FB_PER_HOUR = 5
TIMELAPSE_DIR = os.environ.get('TIMELAPSE_DIR', os.path.join(DATA_DIR, 'timelapse'))  # по умолчанию рядом с SQLite, на том же томе
TG_CHANNEL = os.environ.get('TG_CHANNEL', 'Gruzin_and_Mars')  # публичное превью t.me/s/<канал>
TG_WATCH = os.environ.get('TG_WATCH', '1') != '0'  # 0 — не читать канал Давида
TG_EVERY = 900  # секунд между проверками канала; днём с 7 до 24 по TZ_NAME
# VK: сервисный ключ в bot.env включает чтение стены (wall.get, domain=VK_DOMAIN); без ключа VK выключен.
# Ключ владелец создаёт в vk.com/apps?act=manage (Standalone-приложение → Настройки → «Сервисный ключ доступа»).
VK_SERVICE_KEY = os.environ.get('VK_SERVICE_KEY', '')
VK_DOMAIN = os.environ.get('VK_DOMAIN', 'gruzin_na_marse')

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)
store = None  # создаётся в main()
render_lock = asyncio.Lock()  # один Chromium за раз — память


def now():
    return dt.datetime.now(TZ)


def is_owner(m):
    return bool(m.from_user) and m.from_user.id == OWNER_ID


def kb(draft_id, other=True):
    row1 = [InlineKeyboardButton(text='✅ В канал', callback_data=f'dr:ok:{draft_id}')]
    if other:
        row1.append(InlineKeyboardButton(text='🔄 Другой город', callback_data=f'dr:other:{draft_id}'))
    row2 = [InlineKeyboardButton(text='✏️ Свой текст', callback_data=f'dr:text:{draft_id}'),
            InlineKeyboardButton(text='⏭ Пропустить', callback_data=f'dr:skip:{draft_id}')]
    return InlineKeyboardMarkup(inline_keyboard=[row1, row2])


# ---------- данные сайта ----------
async def fetch_cities():
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
        async with s.get(f'{SITE_URL}/cities/index.json') as r:
            r.raise_for_status()
            return await r.json(content_type=None)


def find_city(cities, q):
    norm = lambda s: s.lower().replace('ё', 'е')
    q = norm(q.strip())
    on = [c for c in cities if c.get('enabled')]
    for c in on:
        if q in (c['id'].lower(), norm(c['name'])):
            return c
    for c in on:  # запасной вариант: начало названия или родительный падеж
        if norm(c['name']).startswith(q) or norm(c.get('nameGen', '')).startswith(q):
            return c
    return None


STOPS_TTL = 3600
_stops_cache = {'at': 0.0, 'data': None}


async def fetch_stops():
    """Остановки «Дороги» с сайта, кэш на час; если сайт недоступен — старый кэш."""
    if _stops_cache['data'] and time.monotonic() - _stops_cache['at'] < STOPS_TTL:
        return _stops_cache['data']
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
            async with s.get(f'{SITE_URL}/cities/doroga/stops.json') as r:
                r.raise_for_status()
                data = await r.json(content_type=None)
        if not isinstance(data, list) or not data:
            raise ValueError('stops.json пуст')
        _stops_cache.update(at=time.monotonic(), data=data)
    except Exception:
        if not _stops_cache['data']:
            raise
        log.warning('stops.json: сайт недоступен, беру кэш')
    return _stops_cache['data']


async def live_road(payload=None):
    """GET (payload=None) или POST /live/road → (код, объект)."""
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
        if payload is None:
            req = s.get(f'{LIVE_URL}/live/road')
        else:
            req = s.post(f'{LIVE_URL}/live/road', headers={'X-Bot-Key': BOT_KEY}, json=payload)
        async with req as r:
            return r.status, await r.json(content_type=None)


async def make_frame(city, hm=None):
    """→ (путь к png в /data/drafts, подпись)."""
    async with render_lock:
        png, scraped = await render(SITE_URL, city['id'], hm)
    caption = content.caption_day(city, scraped)
    path = os.path.join(DATA_DIR, 'drafts', f"{city['id']}-{int(now().timestamp())}.png")
    with open(path, 'wb') as f:
        f.write(png)
    return path, caption


# ---------- черновики и публикация ----------
async def send_draft(draft_id):
    d = store.get_draft(draft_id)
    if d['kind'] == 'news':
        await bot.send_message(OWNER_ID, d['caption'], reply_markup=kb(draft_id, other=False))
    else:
        await bot.send_photo(OWNER_ID, FSInputFile(d['photo_file']), caption=d['caption'], reply_markup=kb(draft_id))


def new_draft(kind, city, caption, photo_file):
    return store.add_draft(kind, city, caption, photo_file, now().isoformat(timespec='seconds'))


def drop_file(path):
    try:
        if path:
            os.remove(path)
    except OSError:
        pass


def post_link(msg_id):
    return f'{CHANNEL_LINK}/{msg_id}'


async def finish_publish(d):
    """Публикует черновик в канал CHANNEL_ID, записывает пост; возвращает id сообщения."""
    day = d['created'][:10]
    if d['kind'] == 'news':
        msg = await bot.send_message(CHANNEL_ID, d['caption'])
    else:
        msg = await bot.send_photo(CHANNEL_ID, FSInputFile(d['photo_file']), caption=d['caption'])
    if d['kind'] == 'news':
        store.add_post(day, '', 'news', 'published', msg.message_id)
        store.set('last_news_date', d['city'])  # в city черновика новостей лежит дата самого свежего раздела
    elif d['kind'] == 'day':
        store.update_post(day, 'day', status='published', msg_id=msg.message_id)
    else:
        store.add_post(day, d['city'], 'frame', 'published', msg.message_id)
    drop_file(d['photo_file'])
    store.del_draft(d['id'])
    return msg.message_id


async def daily():
    """Окно дня: город → кадр → черновик владельцу или сразу в канал."""
    day = now().date().isoformat()
    if store.has_post(day, 'day'):
        return
    cities = await fetch_cities()
    city = content.pick_city(cities, store.history('day'), now().date())
    if not city:
        raise RuntimeError('нет включённых городов')
    path, caption = await make_frame(city)
    store.add_post(day, city['id'], 'day', 'draft')
    did = new_draft('day', city['id'], caption, path)
    if store.get('mode', 'draft') == 'auto':
        msg_id = await finish_publish(store.get_draft(did))
        await bot.send_message(OWNER_ID, f'Опубликовано: {post_link(msg_id)}')
    else:
        await send_draft(did)


async def road_reminder(t):
    """Статус run и последняя точка старше 20 ч → владельцу «Давно нет точки», не чаще раза в сутки и не ночью."""
    if not BOT_KEY or not 8 <= t.hour < 22:
        return
    try:
        code, st = await live_road()
    except Exception as e:  # live недоступен — молча, повтор через 10 минут
        log.warning('road reminder: %s: %s', type(e).__name__, str(e)[:200])
        return
    now_ms = int(time.time() * 1000)
    if code == 200 and road.reminder_due(st, now_ms, int(store.get('road_remind_ms') or 0)):
        store.set('road_remind_ms', now_ms)
        await bot.send_message(OWNER_ID, 'Давно нет точки Давида: /road город')


async def timelapse_loop():
    """Раз в 10 минут (по часам UTC: :00, :10, …) снимает окно «Дороги» для финального таймлапса. Сбой — в лог."""
    while True:
        await asyncio.sleep(timelapse.EVERY - time.time() % timelapse.EVERY + 1)
        try:
            code, st = await live_road()
            if code != 200 or not timelapse.should_shoot(st, int(time.time() * 1000)):
                continue
            async with render_lock:  # не пересекаемся с «Окном дня»: один Chromium за раз
                png, _ = await render(SITE_URL, 'doroga', raw=True, road_state=st)
            timelapse.save(TIMELAPSE_DIR, png, dt.datetime.now(dt.timezone.utc))
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning('timelapse: %s: %s', type(e).__name__, str(e)[:200])


async def fetch_channel():
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20), headers={'User-Agent': 'Mozilla/5.0 (lofi-goroda bot)'}) as s:
        async with s.get(f'https://t.me/s/{TG_CHANNEL}') as r:
            r.raise_for_status()
            return await r.text()


def tg_keyboard(post_id, km):
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text='Да', callback_data=f'tg:y:{post_id}:{km}'),
                                                  InlineKeyboardButton(text='Нет', callback_data=f'tg:n:{post_id}:{km}')]])


async def tg_poll(t):
    """Новые посты канала → город в тексте → владельцу «ставим точку?» с кнопками. Сам точку не ставит."""
    if not TG_WATCH or not BOT_KEY or not 7 <= t.hour <= 23:
        return
    try:
        posts = tgparse.parse_channel_html(await fetch_channel())
    except Exception as e:
        log.warning('tg channel: %s: %s', type(e).__name__, str(e)[:200])
        return
    if not posts:
        return
    last = store.get('tg_last_id')
    if not last:  # первый запуск: запоминаем текущий максимум и ничего не шлём
        store.set('tg_last_id', max(p['id'] for p in posts))
        return
    new = [p for p in posts if p['id'] > int(last)]
    if not new:
        return
    try:
        code, st = await live_road()
        stops = await fetch_stops()
    except Exception as e:  # без состояния и маршрута не решаем; последний id не двигаем, повтор через 15 минут
        log.warning('tg poll: %s: %s', type(e).__name__, str(e)[:200])
        return
    for p in new:
        try:
            await offer_point(p, 'Пост Давида', f'https://t.me/{TG_CHANNEL}/{p["id"]}', str(p['id']), code, st, stops)
        except Exception as e:  # Telegram не принял — повторим этот пост на следующей проверке
            log.warning('tg offer %s: %s: %s', p['id'], type(e).__name__, str(e)[:200])
            return
        store.set('tg_last_id', p['id'])


async def offer_point(p, source, link, key_id, code, st, stops):
    """Общая часть Telegram и VK: город из поста → владельцу «ставим точку?» с кнопками Да/Нет. Сам точку не ставит.
    Не предлагает город, который уже предлагали (из любого источника) за последние двое суток."""
    if code != 200 or st.get('status') not in ('run', 'soon'):
        return False
    cp = road.last_cp(st)
    km_now = cp['km'] if cp else 0
    stop = tgparse.find_city(p['text'], stops, km_now) or tgparse.find_by_geo(p['geo'], stops, km_now)
    if not stop or not tgparse.is_new_point(stop, cp):
        return False
    now_ms = int(time.time() * 1000)
    try:
        last_offer = json.loads(store.get('last_offer') or 'null')
    except ValueError:
        last_offer = None
    if tgparse.same_as_offered(stop, last_offer, now_ms):
        return False
    await bot.send_message(OWNER_ID, f"{source}: «{tgparse.preview(p['text'])}» — ставим точку: "
                                     f"{stop['name']} (~{stop['km']} км)?\n{link}",
                           reply_markup=tg_keyboard(key_id, stop['km']), link_preview_options=LinkPreviewOptions(is_disabled=True))
    store.set('last_offer', json.dumps({'name': stop['name'], 'ts': now_ms}))
    return True


async def fetch_vk():
    params = {'domain': VK_DOMAIN, 'count': 10, 'access_token': VK_SERVICE_KEY, 'v': '5.199'}
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as s:
        async with s.get('https://api.vk.com/method/wall.get', params=params) as r:
            r.raise_for_status()
            return await r.json(content_type=None)


async def vk_poll(t):
    """Новые посты стены ВК → тот же разбор и те же кнопки, что у Telegram. Ключ нигде не логируем."""
    if not VK_SERVICE_KEY or not BOT_KEY or not 7 <= t.hour <= 23:
        return
    try:
        data = await fetch_vk()
    except Exception as e:  # текст исключения может содержать URL с ключом — маскируем
        log.warning('vk wall: %s', vkparse.mask_key(f'{type(e).__name__}: {str(e)[:200]}').replace(VK_SERVICE_KEY, '***'))
        return
    err = vkparse.vk_error(data)
    if err:
        code_, msg = err
        log.warning('vk api error %s: %s', code_, msg.replace(VK_SERVICE_KEY, '***'))
        if code_ in (5, 15, 18, 30) and not store.get('vk_err_notified'):  # один раз, без спама
            store.set('vk_err_notified', str(code_))
            try:
                await bot.send_message(OWNER_ID, f'ключ VK не подошёл: {code_}')
            except Exception as e:
                log.warning('vk notify: %s', type(e).__name__)
        return
    if store.get('vk_err_notified'):  # ключ заработал — сбрасываем флаг
        store.set('vk_err_notified', '')
    posts = vkparse.parse_vk_wall(data)
    if not posts:
        return
    last = store.get('vk_last_id')
    if not last:  # первый запуск: запоминаем максимум и ничего не шлём
        store.set('vk_last_id', max(p['id'] for p in posts))
        return
    new = [p for p in posts if p['id'] > int(last)]
    if not new:
        return
    try:
        code, st = await live_road()
        stops = await fetch_stops()
    except Exception as e:
        log.warning('vk poll: %s: %s', type(e).__name__, str(e)[:200])
        return
    for p in new:
        link = f"https://vk.com/wall{p['owner_id']}_{p['id']}" if p.get('owner_id') else f'https://vk.com/{VK_DOMAIN}'
        try:
            await offer_point(p, 'Пост во ВКонтакте', link, f'vk{p["id"]}', code, st, stops)
        except Exception as e:
            log.warning('vk offer %s: %s: %s', p['id'], type(e).__name__, str(e)[:200])
            return
        store.set('vk_last_id', p['id'])


async def scheduler():
    """Раз в полминуты смотрим время; пост дня один в сутки, после рестарта не дублируется (таблица posts)."""
    fails, retry_at, road_checked, tg_checked, vk_checked = {}, None, 0.0, 0.0, 0.0
    while True:
        try:
            t = now()
            day = t.date().isoformat()
            hh, mm = map(int, POST_TIME.split(':'))
            due = t.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if t >= due and not store.has_post(day, 'day') and fails.get(day, 0) < 3 and (retry_at is None or t >= retry_at):
                try:
                    await daily()
                except Exception as e:
                    fails[day] = fails.get(day, 0) + 1
                    retry_at = t + dt.timedelta(minutes=10)
                    log.exception('daily failed')
                    msg = e if isinstance(e, RenderError) else f'{type(e).__name__}: {str(e)[:200]}'
                    await bot.send_message(OWNER_ID, f'Окно дня не получилось ({fails[day]}/3): {msg}')
            if time.monotonic() - road_checked >= 600:  # напоминание «Где Давид?» — проверка раз в 10 минут
                road_checked = time.monotonic()
                await road_reminder(t)
            if time.monotonic() - tg_checked >= TG_EVERY:  # посты Давида — раз в 15 минут
                tg_checked = time.monotonic()
                await tg_poll(t)
            if VK_SERVICE_KEY and time.monotonic() - vk_checked >= TG_EVERY:  # стена ВК — тоже раз в 15 минут
                vk_checked = time.monotonic()
                await vk_poll(t)
        except Exception:
            log.exception('scheduler')
        await asyncio.sleep(30)


SITE_FB_KEY = 'site_fb_ts'
SITE_FB_EVERY = 60


async def fetch_site_feedback(last):
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
        async with s.get(f'{LIVE_URL}/live/feedback/since', params={'ts': str(last)},
                         headers={'X-Bot-Key': BOT_KEY}) as r:
            r.raise_for_status()
            data = await r.json(content_type=None)
    return data if isinstance(data, list) else []


async def site_feedback_loop():
    """Раз в минуту забирает у live новые отзывы с сайта и шлёт владельцу. Метка site_fb_ts (мс) — в store."""
    if not BOT_KEY:
        log.warning('site feedback: BOT_KEY пуст, пересылка отзывов с сайта отключена')
        return
    if not store.get(SITE_FB_KEY):  # первый запуск: старое не пересылаем
        store.set(SITE_FB_KEY, int(time.time() * 1000))
    while True:
        try:
            last = int(store.get(SITE_FB_KEY) or 0)
            for item in await fetch_site_feedback(last):
                if not isinstance(item, dict) or not isinstance(item.get('ts'), int) or item['ts'] <= last:
                    continue
                await bot.send_message(OWNER_ID, content.format_site_feedback(item))
                last = item['ts']
                store.set(SITE_FB_KEY, last)
        except Exception as e:  # сеть/HTTP/Telegram: в лог, владельцу не пишем; повтор через минуту
            log.warning('site feedback: %s: %s', type(e).__name__, str(e)[:200])
        await asyncio.sleep(SITE_FB_EVERY)


# ---------- команды для всех ----------
START_TEXT = ('Это окно с видом на город: тихая музыка, реальная погода и время, всё как за настоящим стеклом.\n'
              'Откройте, поставьте чай и посидите немного.\n\n'
              'Напишите сюда идею или ошибку — передам создателю окна.')
OWNER_HELP = ('\n\nКоманды владельца:\n/frame <город> [ЧЧ:ММ] — кадр в черновик\n/news — тихие новости из CHANGES.md\n'
              '/mode draft|auto — режим поста дня\n/status — состояние\n'
              '/road [город | км | пауза | едем | финиш | отмена | старт 19.10 08:00] — где Давид\n'
              '/timelapse — кадры для финального ролика')


@router.message(Command('start'), F.chat.type == 'private')
async def cmd_start(m: Message):
    markup = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text='Открыть окно', web_app=WebAppInfo(url=WEBAPP_URL)),
        InlineKeyboardButton(text='Канал', url=CHANNEL_LINK)]])
    await m.answer(START_TEXT + (OWNER_HELP if is_owner(m) else ''), reply_markup=markup)


# ---------- команды владельца ----------
@router.message(Command('frame'), F.func(is_owner))
async def cmd_frame(m: Message, command: CommandObject):
    args = (command.args or '').split()
    hm = args[-1] if args and content.HM.match(args[-1]) else None
    q = ' '.join(args[:-1] if hm else args)
    if not q:
        return await m.answer('Формат: /frame <город или id> [ЧЧ:ММ], например /frame kazan 21:30')
    cities = await fetch_cities()
    city = find_city(cities, q)
    if not city:
        return await m.answer('Не нашёл такой город среди включённых: ' + ', '.join(c['id'] for c in cities if c.get('enabled')))
    await m.answer('Снимаю кадр…')
    path, caption = await make_frame(city, hm)
    await send_draft(new_draft('frame', city['id'], caption, path))


@router.message(Command('road'), F.func(is_owner))
async def cmd_road(m: Message, command: CommandObject):
    try:
        stops = await fetch_stops()
    except Exception as e:
        log.warning('stops: %s: %s', type(e).__name__, str(e)[:200])
        return await m.answer('Не получил список городов с сайта (stops.json). Попробуйте чуть позже.')
    act = road.parse_road(command.args, stops, dt.datetime.now(dt.timezone.utc))
    if act['op'] == 'error':
        return await m.answer(act['text'])
    payload = None
    if act['op'] == 'cp':
        payload = {'cmd': 'cp', 'km': act['km'], 'label': act['label']}
    elif act['op'] == 'status':
        payload = {'cmd': 'status', 'status': act['status']}
    elif act['op'] == 'undo':
        payload = {'cmd': 'undo'}
    elif act['op'] == 'start':
        payload = {'cmd': 'start', 'ts': act['ts']}
    try:
        code, st = await live_road(payload)
    except Exception as e:
        log.warning('road: %s: %s', type(e).__name__, str(e)[:200])
        return await m.answer('Сервер окна не отвечает, ничего не изменилось. Попробуйте позже.')
    if code == 403:
        return await m.answer('Сервер не принял ключ бота (BOT_KEY). Ничего не изменилось.')
    if code != 200:
        err = st.get('error') if isinstance(st, dict) else ''
        return await m.answer('Нечего отменять: осталась только стартовая точка.' if err == 'nothing to undo'
                              else f'Не получилось ({code}): {err or "ошибка сервера"}.')
    now_ms = int(time.time() * 1000)
    await m.answer(road.format_state(st, stops, now_ms) if act['op'] == 'state' else road.format_done(act, st, stops, now_ms))


@router.message(Command('timelapse'), F.func(is_owner))
async def cmd_timelapse(m: Message):
    await m.answer(timelapse.format_stats(await asyncio.to_thread(timelapse.stats, TIMELAPSE_DIR)))


@router.callback_query(F.data.startswith('tg:'), F.from_user.id == OWNER_ID)
async def on_tg_button(cb: CallbackQuery):
    try:
        _, action, post_id, km = cb.data.split(':')
        km = int(km)
    except ValueError:
        return await cb.answer('Не разобрал кнопку')
    key = f'tg_answered_{post_id}'
    if store.get(key):  # двойное нажатие
        return await cb.answer('Уже отвечено')
    if action == 'n':
        store.set(key, 'n')
        await cb.answer()
        if cb.message:
            await cb.message.edit_reply_markup(reply_markup=None)
            await cb.message.answer('Ок, не ставлю.')
        return
    try:
        stops = await fetch_stops()
        stop = next((s for s in stops if s['km'] == km), None)
        if not stop:
            return await cb.answer('Такой остановки уже нет в списке')
        code, st = await live_road({'cmd': 'cp', 'km': km, 'label': stop['name']})
    except Exception as e:
        log.warning('tg yes: %s: %s', type(e).__name__, str(e)[:200])
        return await cb.answer('Сервер окна не отвечает, попробуйте ещё раз', show_alert=True)
    if code != 200:
        return await cb.answer(f'Не получилось ({code})', show_alert=True)
    store.set(key, 'y')
    await cb.answer()
    if cb.message:
        await cb.message.edit_reply_markup(reply_markup=None)
        await cb.message.answer(road.format_done({'op': 'cp', 'km': km, 'label': stop['name']}, st, stops, int(time.time() * 1000)))


@router.message(Command('news'), F.func(is_owner))
async def cmd_news(m: Message):
    try:
        with open(CHANGES, encoding='utf-8') as f:
            sections = content.parse_changes(f.read())
    except OSError:
        return await m.answer('Файл CHANGES.md не найден на сервере.')
    new = content.newer_than(sections, store.get('last_news_date'))
    if not new:
        return await m.answer('Новых записей нет.')
    await send_draft(new_draft('news', new[0][0], content.caption_news(new), ''))


@router.message(Command('mode'), F.func(is_owner))
async def cmd_mode(m: Message, command: CommandObject):
    arg = (command.args or '').strip().lower()
    if arg not in ('draft', 'auto'):
        return await m.answer(f"Режим сейчас: {store.get('mode', 'draft')}. Сменить: /mode draft или /mode auto")
    store.set('mode', arg)
    await m.answer('Теперь пост дня идёт ' + ('сразу в канал.' if arg == 'auto' else 'сначала вам на одобрение.'))


@router.message(Command('status'), F.func(is_owner))
async def cmd_status(m: Message):
    last = store.last_post()
    cities = await fetch_cities()
    day = now().date()
    if store.has_post(day.isoformat(), 'day'):
        day += dt.timedelta(days=1)
    nxt = content.pick_city(cities, store.history('day'), day)
    lines = [f"Режим: {store.get('mode', 'draft')}", f'Время поста: {POST_TIME} ({TZ.key})',
             'Последний пост: ' + (f"{last['date']} {last['kind']} {last['city']} {post_link(last['msg_id'])}" if last else 'ещё не было'),
             f"Следующий город: {nxt['name'] if nxt else 'нет'} ({day.isoformat()})",
             f"Новости опубликованы по: {store.get('last_news_date') or 'ещё не было'}"]
    await m.answer('\n'.join(lines))


# ---------- кнопки черновиков ----------
@router.callback_query(F.data.startswith('dr:'), F.from_user.id == OWNER_ID)
async def on_draft_button(cb: CallbackQuery):
    _, action, sid = cb.data.split(':')
    d = store.get_draft(int(sid))
    if not d:
        await cb.answer('Черновик уже обработан.', show_alert=True)
        return await cb.message.edit_reply_markup(reply_markup=None)
    await cb.answer()
    await cb.message.edit_reply_markup(reply_markup=None)
    day = d['created'][:10]
    if action == 'ok':
        msg_id = await finish_publish(d)
        await cb.message.answer(f'Опубликовано: {post_link(msg_id)}')
    elif action == 'skip':
        if d['kind'] == 'day':
            store.update_post(day, 'day', status='skipped')
        drop_file(d['photo_file'])
        store.del_draft(d['id'])
        await cb.message.answer('Пропущено.')
    elif action == 'text':
        store.set('await_text', d['id'])
        await cb.message.answer('Пришлите следующим сообщением новый текст подписи.')
    elif action == 'other':
        await cb.message.answer('Ищу другой город…')
        cities = await fetch_cities()
        city = content.pick_city(cities, store.history('day'), dt.date.fromisoformat(day), skip={d['city']})
        if not city:
            return await cb.message.answer('Других включённых городов нет.')
        path, caption = await make_frame(city)
        drop_file(d['photo_file'])
        store.update_draft(d['id'], city=city['id'], caption=caption, photo_file=path)
        if d['kind'] == 'day':
            store.update_post(day, 'day', city=city['id'])
        await send_draft(d['id'])


# ---------- текстовые сообщения ----------
@router.message(F.text, ~F.text.startswith('/'), F.chat.type == 'private', F.func(is_owner))
async def owner_text(m: Message):
    # ответ реплаем на копию отзыва → автору
    if m.reply_to_message:
        uid = store.map_get(m.reply_to_message.message_id)
        if uid:
            try:
                await bot.send_message(uid, f'Ответ от создателя окна: {m.text}')
                await m.answer('Отправлено.')
            except Exception as e:
                await m.answer(f'Не отправилось: {type(e).__name__}')
            return
    # «Свой текст» для черновика
    pending = store.get('await_text')
    if pending:
        d = store.get_draft(int(pending))
        store.set('await_text', '')
        if not d:
            return await m.answer('Черновик уже обработан.')
        limit = content.MESSAGE_MAX if d['kind'] == 'news' else content.CAPTION_MAX
        if len(m.text) > limit:
            store.set('await_text', d['id'])
            return await m.answer(f'Слишком длинно: {len(m.text)} из {limit} знаков. Сократите и пришлите снова.')
        store.update_draft(d['id'], caption=m.text)
        return await send_draft(d['id'])
    await m.answer('Не понял. Список команд — /start.')


@router.message(F.text, ~F.text.startswith('/'), F.chat.type == 'private')
async def user_feedback(m: Message):
    """Любой текст в личке (не от владельца) — отзыв: в live.py, копия владельцу."""
    u = m.from_user
    if store.fb_count(u.id) >= FB_PER_HOUR:
        return await m.answer('Вы уже много написали за час — давайте чуть позже, я всё передал.')
    contact = f'tg:@{u.username}' if u.username else f'tg:{u.id}'
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as s:
            async with s.post(f'{LIVE_URL}/feedback', headers={'X-Bot-Key': BOT_KEY},
                              json={'kind': 'other', 'text': m.text, 'contact': contact, 'city': ''}) as r:
                ok = r.status == 200
    except Exception:
        log.exception('feedback post')
        ok = False
    if not ok:
        return await m.answer('Сейчас не получилось передать. Попробуйте чуть позже.')
    store.fb_add(u.id)
    await m.answer('Спасибо! Передал создателю окна.')
    who = f'@{u.username}' if u.username else f'{u.full_name} (id {u.id})'
    copy = await bot.send_message(OWNER_ID, f'Отзыв от {who}:\n\n{m.text}')
    store.map_add(copy.message_id, u.id)


@router.message(F.chat.type == 'private')
async def other_messages(m: Message):
    if not is_owner(m):
        await m.answer('Пока принимаю только текст. Напишите словами, что хотели сказать.')


@dp.errors()
async def on_error(event):
    log.error('handler error', exc_info=event.exception)
    try:
        await bot.send_message(OWNER_ID, f'Ошибка: {type(event.exception).__name__}: {str(event.exception)[:200]}')
    except Exception:
        pass
    return True


async def main():
    global store
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    os.makedirs(os.path.join(DATA_DIR, 'drafts'), exist_ok=True)
    os.makedirs(TIMELAPSE_DIR, exist_ok=True)
    store = Store(os.path.join(DATA_DIR, 'bot.sqlite'))
    await bot.set_my_commands([BotCommand(command='start', description='О боте')], scope=BotCommandScopeDefault())
    await bot.set_my_commands(
        [BotCommand(command='start', description='О боте'), BotCommand(command='frame', description='Кадр: /frame <город> [ЧЧ:ММ]'),
         BotCommand(command='news', description='Тихие новости'), BotCommand(command='mode', description='draft или auto'),
         BotCommand(command='status', description='Состояние'),
         BotCommand(command='road', description='Где Давид: /road город'),
         BotCommand(command='timelapse', description='Кадры для таймлапса')],
        scope=BotCommandScopeChat(chat_id=OWNER_ID))
    try:  # кнопка меню во всех чатах открывает сайт как Mini App
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text='Окно', web_app=WebAppInfo(url=WEBAPP_URL)))
    except Exception:
        log.exception('menu button')
    task = asyncio.create_task(scheduler())
    fb_task = asyncio.create_task(site_feedback_loop())
    tl_task = asyncio.create_task(timelapse_loop())
    try:
        await dp.start_polling(bot, allowed_updates=['message', 'callback_query'])
    finally:
        task.cancel()
        fb_task.cancel()
        tl_task.cancel()
        await bot.session.close()


if __name__ == '__main__':
    asyncio.run(main())
