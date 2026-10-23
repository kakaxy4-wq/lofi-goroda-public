"""Добавляет в prompts.json по 30 треков для БАМа, Анадыря и Транссиба — в очередь на GPU.
Базовый стиль партии общий; у поездов — мерный ритм колёс и дорога, у Анадыря — тишина и вьюга.
Запуск: py -3 tools/music/add_trains.py (идемпотентно: существующие id не дублируются)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
BASE = ("lo-fi hip hop, instrumental, chill beat, jazzy chords, warm Rhodes piano, dusty vinyl crackle, "
        "tape saturation, soft boom bap drums, mellow bassline, cozy, relaxed")
NEG = ("vocals, singing, voice, lyrics, rap, choir, humming, spoken word, harsh distortion, aggressive drums, "
       "EDM drop, trap hi-hats, loud cymbals, abrupt ending")
KEYS = ["A minor", "D minor", "E minor", "G major", "C major", "F major", "B minor", "D major", "G minor", "E major"]

TRAINS = {
    "bam": ("train journey, steady soft rail clicks rhythm, rolling motion, taiga at dawn, distant harmonica pad, nostalgic, wide open space", [
        ("tajshet-utrom", "Тайшет утром"), ("bratskoe-more", "Братское море"), ("lena-u-ust-kuta", "Лена у Усть-Кута"),
        ("severobajkalsk", "Северобайкальск"), ("bajkalskij-tonnel", "Байкальский тоннель"), ("severomujskij-tonnel", "Северомуйский тоннель"),
        ("taksimo", "Таксимо"), ("gory-kodar", "Горы Кодар"), ("charskie-peski", "Чарские пески"),
        ("tynda", "Тында"), ("zejskoe-more", "Зейское море"), ("novyj-urgal", "Новый Ургал"),
        ("dusse-alin", "Дуссе-Алинь"), ("amur-u-komsomolska", "Амур у Комсомольска"), ("vanino", "Ванино"),
        ("sovetskaya-gavan", "Советская Гавань"), ("zolotoe-zveno", "Золотое звено"), ("listvennicy", "Лиственницы"),
        ("stuk-koles", "Стук колёс"), ("kupe-nochyu", "Купе ночью"), ("titan-i-chaj", "Титан и чай"),
        ("stanciya-v-tumane", "Станция в тумане"), ("sneg-na-shpalah", "Снег на шпалах"), ("ogni-vagona", "Огни вагона"),
        ("tajga-za-oknom", "Тайга за окном"), ("perron-v-pyat-utra", "Перрон в пять утра"), ("relsy-do-gorizonta", "Рельсы до горизонта"),
        ("polka-u-okna", "Полка у окна"), ("vstrechnyj-poezd", "Встречный поезд"), ("magistral", "Магистраль")]),
    "anadyr": ("arctic quiet, soft snowstorm wind, sparse felt piano, distant seagull tone, cold airy pads, very slow and calm, northern lights shimmer", [
        ("sopka-dionisiya", "Сопка Дионисия"), ("teplyak", "Тепляк"), ("purga", "Пурга"),
        ("liman", "Лиман"), ("belye-nochi-chukotki", "Белые ночи Чукотки"), ("severnoe-siyanie", "Северное сияние"),
        ("baklany", "Бакланы"), ("kontejnery-vo-dvore", "Контейнеры во дворе"), ("kvadrat-na-asfalte", "Квадрат на асфальте"),
        ("par-nad-lyukom", "Пар над люком"), ("vorona-na-bake", "Ворона на баке"), ("snegohod-v-nochi", "Снегоход в ночи"),
        ("svet-v-pyatietazhke", "Свет в пятиэтажке"), ("merzlota", "Мерзлота"), ("svai", "Сваи"),
        ("korjushka-vesnoj", "Корюшка весной"), ("tec-v-moroznom-dymu", "ТЭЦ в морозном дыму"), ("salatovyj-dom", "Салатовый дом"),
        ("novomariinsk", "Новомариинск"), ("polyarnyj-veter", "Полярный ветер"), ("tihij-dvor", "Тихий двор"),
        ("chaj-s-moroshkoj", "Чай с морошкой"), ("kot-na-bataree", "Кот на батарее"), ("vertolet-cherez-liman", "Вертолёт через лиман"),
        ("kraj-zemli", "Край земли"), ("ranshe-vseh", "Раньше всех"), ("dlinnaya-zima", "Длинная зима"),
        ("svetlaya-polnoch", "Светлая полночь"), ("pervyj-sneg", "Первый снег"), ("sobaka-u-teplyaka", "Собака у тепляка")]),
    "transsib": ("long train journey across the country, gentle rail rhythm, warm acoustic guitar, accordion pad far away, steppe and taiga, nostalgic, sunrise over rails", [
        ("yaroslavskij-vokzal", "Ярославский вокзал"), ("volga-u-yaroslavlya", "Волга у Ярославля"), ("perm", "Пермь"),
        ("evropa-aziya", "Европа — Азия"), ("ural", "Уральский перевал"), ("ekaterinburg", "Екатеринбург"),
        ("tyumen", "Тюмень"), ("omsk", "Омск"), ("barabinskaya-step", "Барабинская степь"),
        ("most-cherez-ob", "Мост через Обь"), ("novosibirsk", "Новосибирск"), ("krasnoyarsk", "Красноярск"),
        ("enisej", "Енисей"), ("tajshet", "Тайшет"), ("irkutsk", "Иркутск"),
        ("bajkal-iz-okna", "Байкал из окна"), ("slyudyanka", "Слюдянка"), ("ulan-ude", "Улан-Удэ"),
        ("chita", "Чита"), ("amurskij-most", "Амурский мост"), ("habarovsk", "Хабаровск"),
        ("birobidzhan", "Биробиджан"), ("vladivostok", "Владивосток"), ("9288-km", "9288 километров"),
        ("chaj-v-podstakannike", "Чай в подстаканнике"), ("nochnoj-perron", "Ночной перрон"), ("step-na-zakate", "Степь на закате"),
        ("sem-chasovyh-poyasov", "Семь часовых поясов"), ("verhnyaya-polka", "Верхняя полка"), ("doroga-domoj", "Дорога домой")]),
}

data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
tracks = data["tracks"]
have = {t["id"] for t in tracks}
rnd = random.Random(20261009)
added = 0
for city, (flavor, titles) in TRAINS.items():
    assert len(titles) == 30, (city, len(titles))
    for i, (slug, title) in enumerate(titles, 1):
        tid = f"{city}-{i:02d}-{slug}"
        if tid in have:
            continue
        tracks.append({"id": tid, "city": city, "title": title, "tags": f"{BASE}, {flavor}",
                       "bpm": rnd.randint(68, 86), "key": rnd.choice(KEYS), "duration": rnd.choice([150, 165, 180, 195, 210]),
                       "negative": NEG})
        added += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("добавлено", added, "всего", len(tracks))
