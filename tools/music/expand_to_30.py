"""Доводит каждый город в prompts.json до 30 треков: «Место, настроение».
Стиль города (flavor) берётся из его уже существующих треков, к нему — тег настроения."""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
TARGET = 30
MOODS = [("утро", "early morning, soft light"), ("дождь", "rainy day, rain ambience"), ("ночь", "late night, sleepy"),
         ("первый снег", "first snow, winter hush"), ("туман", "foggy, hazy"), ("закат", "sunset, golden hour"),
         ("выходной", "lazy sunday, slow"), ("после работы", "after work evening, unwinding"), ("долгий вечер", "long summer evening, warm")]
PLACES = {
    "kazan": ["Казанка", "Баумана", "Озеро Кабан", "Старо-Татарская слобода", "Кремлёвская дамба", "Мост Миллениум"],
    "vladimir": ["Клязьма", "Успенский собор", "Георгиевская улица", "Козлов вал", "Дмитриевский собор", "Смотровая площадка"],
    "yaroslavl": ["Волга", "Которосль", "Советская площадь", "Губернаторский сад", "Демидовский столп", "Даманский остров"],
    "vologda": ["Река Вологда", "Софийский собор", "Каменный мост", "Улица Ленина", "Прилуки", "Соборная горка"],
    "krasnodar": ["Кубань", "Чистяковская роща", "Екатерининский сквер", "Затон", "Театральная площадь", "Городской сад"],
    "sochi": ["Ривьера", "Мацеста", "Красная Поляна", "Хоста", "Морпорт", "Олимпийский парк"],
    "nnovgorod": ["Ока", "Волга", "Рождественская улица", "Верхне-Волжская набережная", "Александровский сад", "Бор за рекой"],
    "kaliningrad": ["Преголя", "Куршская коса", "Зеленоградск", "Нижнее озеро", "Кафедральный собор", "Светлогорск"],
    "vladivostok": ["Спортивная гавань", "Светланская", "Золотой мост", "Эгершельд", "Чуркин", "Шаморы"],
    "samara": ["Волга", "Набережная", "Жигули", "Ленинградская", "Струкачёвский парк", "Речной вокзал"],
    "ekaterinburg": ["Плотинка", "Городской пруд", "Исеть", "Вайнера", "Площадь 1905 года", "Харитоновский парк"],
    "irkutsk": ["Ангара", "130-й квартал", "Глазковский мост", "Листвянка", "Набережная", "Иерусалимская гора"],
    "vnovgorod": ["Волхов", "Детинец", "Ярославово дворище", "Ильмень", "Кокуй", "Юрьев монастырь"],
    "murmansk": ["Семёновское озеро", "Проспект Ленина", "Кольский мост", "Абрам-мыс", "Териберка", "Долина Уюта"],
}
KEYS = ["A minor", "D minor", "E minor", "G major", "C major", "F major", "B minor", "D major", "G minor", "E major"]
TR = str.maketrans({"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "j", "к": "k",
                    "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c",
                    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", " ": "-", "-": "-"})
slug = lambda s: "".join(ch for ch in s.lower().translate(TR) if ch.isalnum() or ch == "-")[:28].strip("-")

data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
tracks = data["tracks"]
rnd = random.Random(30)
added = 0
for city, places in PLACES.items():
    own = [t for t in tracks if t["city"] == city]
    if not own:
        continue
    flavor = own[0]["tags"]
    # базовые теги без «настроения» предыдущего трека оставляем как есть: у города один характер
    n, k = len(own), 0
    combos = [(p, m) for m in MOODS for p in places]
    rnd.shuffle(combos)
    for place, (mood, mood_en) in combos:
        if n >= TARGET:
            break
        title = f"{place}, {mood}"
        tid = f"{city}-{n + 1:02d}-{slug(place)}-{slug(mood)}"
        if any(t["id"] == tid for t in tracks):
            continue
        tracks.append({"id": tid, "city": city, "title": title, "tags": f"{flavor}, {mood_en}",
                       "bpm": rnd.randint(68, 86), "key": rnd.choice(KEYS), "duration": rnd.choice([150, 165, 180, 195, 210]),
                       "negative": own[0]["negative"]})
        n += 1; added += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("добавлено", added)
