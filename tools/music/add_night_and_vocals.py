"""Очередь на GPU: ночной эфир (по 8 медленных треков на каждое окно) и пилот треков с голосом.
Ночной эфир звучит с 1:00 до 6:00 по местному времени (site/engine/audio.js берёт треки с bpm ≤ 74).
Тексты песен — оригинальные, написаны для проекта. Запуск: py -3 tools/music/add_night_and_vocals.py
(идемпотентно: существующие id не дублируются)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
KEYS = ["A minor", "D minor", "E minor", "G major", "C major", "F major", "B minor", "D major"]
NIGHT_BASE = ("lo-fi, instrumental, late night, very slow, sleepy ambient lofi, soft felt piano, warm Rhodes, airy pads, "
              "minimal brushed drums, soft vinyl crackle, tape warmth, distant rain, calm, intimate, no sudden changes")
NEG = ("vocals, singing, voice, lyrics, rap, choir, humming, spoken word, harsh distortion, aggressive drums, "
       "EDM drop, trap hi-hats, loud cymbals, abrupt ending")
NIGHT_TITLES = [("polnoch-u-okna", "Полночь у окна"), ("tri-chasa-nochi", "Три часа ночи"), ("spyat-dvory", "Спят дворы"),
                ("poslednij-svet", "Последний свет в окне"), ("nochnoj-chaj", "Ночной чай"), ("tishina", "Тишина над городом"),
                ("pered-rassvetom", "Перед рассветом"), ("sinij-chas", "Синий час")]
CITIES = ["piter", "kazan", "vladimir", "yaroslavl", "vologda", "krasnodar", "sochi", "nnovgorod", "kaliningrad",
          "vladivostok", "murmansk", "samara", "ekaterinburg", "irkutsk", "vnovgorod", "bam", "anadyr", "transsib"]

VOCAL_NEG = "harsh distortion, aggressive drums, EDM drop, trap hi-hats, shouting, screaming, loud cymbals, abrupt ending"
VOCALS = [
    {"id": "piter-v01-okno-na-nevu", "city": "piter", "title": "Окно на Неву", "bpm": 80, "key": "A minor", "duration": 180,
     "tags": "lo-fi hip hop, chill russian rap, soft male vocals, laid-back flow, jazzy chords, warm Rhodes piano, dusty vinyl crackle, boom bap drums, mellow bassline, night city mood",
     "lyrics": """[verse]
Чайник щёлкнул, за окном ещё темно,
мост опустили, и Нева течёт в окно.
Кот на подоконнике считает огоньки,
я считаю строчки — до утра они легки.
Шпиль ловит небо, как иголка нить,
этот город учит никуда не спешить.

[chorus]
Окно на Неву, чай остывает,
город не спит — он просто мечтает.
Окно на Неву, тихо и рядом,
мне ничего больше не надо."""},
    {"id": "kazan-v01-ogni-kazanki", "city": "kazan", "title": "Огни Казанки", "bpm": 76, "key": "D major", "duration": 180,
     "tags": "lo-fi, mellow pop, soft female vocals, gentle singing, warm guitar, Rhodes piano, dusty vinyl crackle, soft drums, evening river breeze, cozy",
     "lyrics": """[verse]
Мост меняет цвета над водой,
вечер медленный, тёплый, простой.
Купола в подсветке, ветер с реки,
и шаги на набережной так легки.

[chorus]
Огни Казанки, тихий свет,
я напишу тебе в ответ.
Огни Казанки, чай и плед,
и ничего важнее нет."""},
    {"id": "bam-v01-stuk-koles", "city": "bam", "title": "Стук колёс", "bpm": 78, "key": "E minor", "duration": 180,
     "tags": "lo-fi hip hop, chill russian rap, soft male vocals, laid-back flow, steady rail clicks rhythm, warm guitar, dusty vinyl crackle, soft boom bap drums, travel mood",
     "lyrics": """[verse]
Стук колёс, как метроном под полкой,
тайга за окном золотится иголкой.
Станция в тумане, перрон в пять утра,
проводница несёт стакан — и снова пора.
Тоннель под хребтом — пятнадцать минут темноты,
выходим на свет — и снова горы, мосты.

[chorus]
Стук колёс, стук колёс,
поезд меня далеко увёз.
Чай в подстаканнике, тайга в окне,
дорога тянется — и хорошо мне."""},
    {"id": "anadyr-v01-purga", "city": "anadyr", "title": "Пурга", "bpm": 70, "key": "C major", "duration": 180,
     "tags": "lo-fi, slow dreamy song, soft female vocals, gentle singing, felt piano, airy pads, soft snowstorm wind, minimal drums, cozy winter night",
     "lyrics": """[verse]
За окном пурга заметает двор,
тепляк парит, как старый разговор.
Свет в пятиэтажке, кот у батареи,
ночь на краю земли становится теплее.

[chorus]
Пурга, пурга, укрой этот город,
я дома, мне не страшен холод.
Пурга, пурга, до самой весны,
мне снятся тёплые сны."""},
]

data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
tracks = data["tracks"]
have = {t["id"] for t in tracks}
rnd = random.Random(20261010)
added = 0
for city in CITIES:
    for i, (slug, title) in enumerate(NIGHT_TITLES, 1):
        tid = f"{city}-n{i:02d}-{slug}"
        if tid in have:
            continue
        tracks.append({"id": tid, "city": city, "title": title, "tags": NIGHT_BASE, "bpm": rnd.randint(58, 68),
                       "key": rnd.choice(KEYS), "duration": rnd.choice([180, 195, 210, 240]), "negative": NEG, "night": True})
        added += 1
for v in VOCALS:
    if v["id"] not in have:
        tracks.append({**v, "negative": VOCAL_NEG, "vocal": True})
        added += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("добавлено", added, "всего", len(tracks))
