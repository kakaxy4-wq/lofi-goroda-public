"""Набор для релиза альбома города на стриминги (Яндекс Музыка и др. через дистрибьютора).

Собирает в release/<id>-<часть>/: tracklist.csv (номер, название, файл, длительность)
и release.md (метаданные, пометка об ИИ, что заполнить). Обложку 3000×3000 кладём отдельно
(рисуется в браузере из окна города, см. docs). Аудио: дистрибьюторы принимают WAV/FLAC —
MP3 из music/final подходят только для прослушки, оригиналы WAV — с GPU-сервера.

Запуск: py -3 tools/make_release.py piter 1 10   — город, номер части, сколько треков
"""
import csv
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
city, part, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cities = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'site', 'cities', 'index.json'), encoding='utf-8'))}
pl = json.load(open(os.path.join(ROOT, 'site', 'cities', city, 'music', 'playlist.json'), encoding='utf-8'))
name = cities[city]['name']
start = (part - 1) * n
tracks = pl[start:start + n]
out = os.path.join(ROOT, 'release', f'{city}-{part}')
os.makedirs(out, exist_ok=True)

with open(os.path.join(out, 'tracklist.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f, delimiter=';')
    w.writerow(['№', 'Название', 'Файл (mp3 для прослушки; в релиз — WAV с тем же именем)', 'Длительность'])
    for i, t in enumerate(tracks, 1):
        base = os.path.basename(t['src'])
        w.writerow([i, t['title'], base.replace('.mp3', '-v1.wav'), f"{int(t['dur']) // 60}:{int(t['dur']) % 60:02d}"])

total = sum(t['dur'] for t in tracks)
md = f"""# Релиз: «Радио {name}», часть {part}

Готовит: tools/make_release.py. Загружает и оплачивает владелец проекта.

## Метаданные
- Артист: Лофи-города
- Альбом: Радио {name}, часть {part}
- Тип: альбом, {len(tracks)} треков, {int(total // 60)} мин
- Жанр: Lo-Fi / Chillhop (инструментал, без вокала)
- Язык: без слов
- Год: 2026
- Обложка: cover.png, 3000×3000, RGB, без ссылок и логотипов площадок
- Использование ИИ: **«Трек полностью создан с использованием ИИ»** — музыка сгенерирована моделью
  ACE-Step 1.5 (лицензия MIT; авторы модели разрешают коммерческое использование результатов)
- YouTube Content ID: **не подключать** — иначе стримеры с окном сайта (?obs) и наши ролики получат претензии

## Описание для карточки релиза
Лофи для работы и отдыха из живого окна в {name if city != 'piter' else 'Санкт-Петербург'}: lofi-goroda.ru.
Сайт показывает город в реальном времени и погоде, а эфир играет эти треки синхронно для всех.

## Что сделано людьми и инструментами (заполнить и проверить перед подачей)
Дистрибьюторы просят описать вклад человека. Проверьте и оставьте только то, что верно:
- [ ] Идея и концепция серии «Радио <город>», выбор настроения для каждого трека
- [ ] Описания треков для генерации (prompts.json) — кто составлял
- [ ] Названия треков и порядок в альбоме
- [ ] Сведение громкости (loudnorm −16 LUFS) и фейды — tools/music/generate.py
- [ ] Обложка — пиксельное окно сайта, нарисованное кодом проекта

## Треки
""" + '\n'.join(f"{i}. {t['title']} — {int(t['dur']) // 60}:{int(t['dur']) % 60:02d}" for i, t in enumerate(tracks, 1)) + """

## Чего не хватает для подачи
- [ ] WAV-оригиналы этих треков (GPU-сервер) — MP3 дистрибьюторы не принимают
- [ ] Аккаунт у дистрибьютора, принимающего ИИ-музыку, и оплата релиза
"""
open(os.path.join(out, 'release.md'), 'w', encoding='utf-8', newline='\n').write(md)
print(out, len(tracks), 'треков,', int(total // 60), 'мин')
