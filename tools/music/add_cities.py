"""Добавляет в prompts.json треки для следующих городов (по 12 на город).
Базовый стиль партии общий, у каждого города — свой лёгкий акцент инструментов и настроения.
Запуск: python add_cities.py (идемпотентно: уже существующие id не дублируются)."""
import json
import random
from pathlib import Path

HERE = Path(__file__).parent
BASE = ("lo-fi hip hop, instrumental, chill beat, jazzy chords, warm Rhodes piano, dusty vinyl crackle, "
        "tape saturation, soft boom bap drums, mellow bassline, cozy, relaxed")
NEG = ("vocals, singing, voice, lyrics, rap, choir, humming, spoken word, harsh distortion, aggressive drums, "
       "EDM drop, trap hi-hats, loud cymbals, abrupt ending")
KEYS = ["A minor", "D minor", "E minor", "G major", "C major", "F major", "B minor", "D major", "G minor", "E major"]

CITIES = {
    "vladimir": ("white stone churches mood, soft felt piano, gentle strings pad, old town calm, morning mist", [
        ("zolotye-vorota", "Золотые ворота"), ("utro-na-klyazme", "Утро на Клязьме"), ("belyj-kamen", "Белый камень"),
        ("sobornaya-ploshchad", "Соборная площадь"), ("tuman-nad-poymoj", "Туман над поймой"), ("vechernyaya-bolshaya-moskovskaya", "Вечер на Большой Московской"),
        ("staryj-tramvaj", "Старый трамвайный путь"), ("patriarshij-sad", "Патриарший сад"), ("dozhd-na-kupolah", "Дождь на куполах"),
        ("zima-vo-vladimire", "Зима во Владимире"), ("chaj-s-medovukoj", "Чай у окна"), ("zakat-nad-klyazmoj", "Закат над Клязьмой")]),
    "yaroslavl": ("volga river breeze, warm guitar, soft accordion pad in the distance, golden autumn feeling", [
        ("strelka-volgi", "Стрелка Волги и Которосли"), ("volzhskaya-naberezhnaya", "Волжская набережная"), ("utro-u-teatra", "Утро у театра Волкова"),
        ("parom-cherez-volgu", "Паром через Волгу"), ("zolotaya-osen", "Золотая осень"), ("medvezhij-ugol", "Медвежий угол"),
        ("vecher-na-kotorosli", "Вечер на Которосли"), ("dozhd-po-kryshan", "Дождь по крышам"), ("zimnyaya-volga", "Зимняя Волга"),
        ("belaya-noch-na-volge", "Светлая ночь на Волге"), ("stanciya-yaroslavl", "Станция Ярославль"), ("sad-u-reki", "Сад у реки")]),
    "vologda": ("wooden lace, snowy quiet, soft vibraphone, warm upright bass, northern calm, gentle bells tone", [
        ("derevyannoe-kruzhevo", "Деревянное кружево"), ("kremlevskaya-ploshchad", "Кремлёвская площадь"), ("utro-na-vologde", "Утро на реке Вологде"),
        ("sneg-na-nalichnikah", "Снег на наличниках"), ("vologodskoe-maslo", "Масло и чай"), ("tihij-kvartal", "Тихий квартал"),
        ("sever-blizko", "Север близко"), ("belye-nochi-vologdy", "Светлые ночи"), ("dozhd-v-derevyannom-gorode", "Дождь в деревянном городе"),
        ("vecher-u-pechki", "Вечер у печки"), ("most-cherez-reku", "Мост через реку"), ("nochnaya-metel", "Ночная метель")]),
    "krasnodar": ("southern warm evening, nylon guitar, soft latin groove, sunny, relaxed, cicadas mood", [
        ("ulica-krasnaya", "Улица Красная"), ("park-galickogo", "Парк Галицкого"), ("vecher-na-kubani", "Вечер на Кубани"),
        ("yuzhnoe-solnce", "Южное солнце"), ("teplaya-noch", "Тёплая ночь"), ("fontany-v-parke", "Фонтаны в парке"),
        ("chereshnya", "Черешня"), ("rozy-na-krasnoj", "Розы на Красной"), ("dozhd-v-zharu", "Дождь в жару"),
        ("osen-na-yuge", "Осень на юге"), ("kofe-na-verande", "Кофе на веранде"), ("zakat-nad-rekoj", "Закат над рекой")]),
    "sochi": ("sea waves mood, sunset, soft nylon guitar, airy synth pads, palm trees, summer breeze", [
        ("morskoj-vokzal", "Морской вокзал"), ("pirs-na-zakate", "Пирс на закате"), ("palmy-i-dozhd", "Пальмы и дождь"),
        ("gornyj-vozduh", "Горный воздух"), ("kurortnyj-prospekt", "Курортный проспект"), ("teplaya-galka", "Тёплая галька"),
        ("dendrarij", "Дендрарий"), ("nochnoe-more", "Ночное море"), ("gory-v-oblakah", "Горы в облаках"),
        ("mandariny", "Мандарины"), ("utrennij-plyazh", "Утренний пляж"), ("chajnye-plantacii", "Чайные плантации")]),
    "nnovgorod": ("two rivers meeting, wide view, warm Rhodes, soft brass pad, calm evening, cable car mood", [
        ("strelka-oki-i-volgi", "Стрелка Оки и Волги"), ("chkalovskaya-lestnica", "Чкаловская лестница"), ("kanatnaya-doroga", "Канатная дорога"),
        ("bolshaya-pokrovskaya", "Большая Покровская"), ("nizhne-volzhskaya", "Нижне-Волжская набережная"), ("zakat-s-otkosa", "Закат с Откоса"),
        ("kremlevskaya-stena", "Кремлёвская стена"), ("dozhd-na-rozhdestvenskoj", "Дождь на Рождественской"), ("zimnij-otkos", "Зимний Откос"),
        ("utro-na-oke", "Утро на Оке"), ("fonari-na-mostu", "Фонари на мосту"), ("pirozhok-i-chaj", "Пирожок и чай")]),
    "kaliningrad": ("baltic sea breeze, soft clarinet, gentle cobblestone mood, amber warm light, misty", [
        ("ostrov-kanta", "Остров Канта"), ("rybnaya-derevnya", "Рыбная деревня"), ("verhnee-ozero", "Верхнее озеро"),
        ("baltijskij-veter", "Балтийский ветер"), ("yantar", "Янтарь"), ("brusschatka", "Брусчатка"),
        ("tuman-nad-pregolej", "Туман над Преголей"), ("zakat-na-kose", "Закат на косе"), ("korolevskie-vorota", "Королевские ворота"),
        ("dozhd-v-amalienau", "Дождь в Амалиенау"), ("tihaya-gavan", "Тихая гавань"), ("zimnee-more", "Зимнее море")]),
    "vladivostok": ("pacific ocean fog, ship horn tone in the distance, soft dub delays, dorian mood, sea wind", [
        ("zolotoj-rog", "Золотой Рог"), ("tuman-na-mostu", "Туман на мосту"), ("orlinoe-gnezdo", "Орлиное гнездо"),
        ("vostochnyj-bosfor", "Восточный Босфор"), ("russkij-ostrov", "Русский остров"), ("tokarevskij-mayak", "Токаревский маяк"),
        ("funikuler", "Фуникулёр"), ("utro-v-portu", "Утро в порту"), ("krasnaya-ikra", "Рассвет над бухтой"),
        ("tajfun", "Тёплый тайфун"), ("zimnyaya-buhta", "Зимняя бухта"), ("tigr-na-sopkah", "Тигр на сопках")]),
    "samara": ("wide volga river, warm summer evening, soft guitar, mellow sax pad, river breeze, relaxed", [
        ("naberezhnaya", "Набережная"), ("zhiguli", "Жигули на закате"), ("volga-shirokaya", "Широкая Волга"),
        ("rechnoj-vokzal", "Речной вокзал"), ("leningradskaya", "Ленинградская"), ("utro-na-volge", "Утро на Волге"),
        ("shiryaevo", "Ширяево"), ("dozhd-na-naberezhnoj", "Дождь на набережной"), ("zimnyaya-volga", "Зимняя Волга"),
        ("teplyj-vecher", "Тёплый вечер"), ("tramvaj-v-staroj-samare", "Трамвай в старой Самаре"), ("plyazh", "Пляж")]),
    "ekaterinburg": ("ural mountains calm, warm Rhodes, soft synth bass, urban night, malachite green mood", [
        ("plotinka", "Плотинка"), ("gorodskoj-prud", "Городской пруд"), ("iset", "Исеть"),
        ("vajnera", "Вайнера"), ("noch-v-siti", "Ночь в Сити"), ("malahit", "Малахит"),
        ("pervyj-sneg-na-urale", "Первый снег на Урале"), ("tramvaj-na-lenina", "Трамвай на проспекте"), ("ploshchad-1905", "Площадь 1905 года"),
        ("utro-na-prudu", "Утро на пруду"), ("dozhd-v-ekb", "Дождь в Екатеринбурге"), ("bazhov", "Сказы Бажова")]),
    "irkutsk": ("siberian river mist, angara cold clear water, soft piano, airy pads, frosty quiet, baikal mood", [
        ("angara", "Ангара"), ("130-kvartal", "130-й квартал"), ("parenie-angary", "Парение Ангары"),
        ("derevyannoe-kruzhevo-irkutska", "Деревянное кружево"), ("babr", "Бабр"), ("doroga-na-bajkal", "Дорога на Байкал"),
        ("listvyanka", "Листвянка"), ("lebedi-zimoj", "Лебеди зимой"), ("glazkovskij-most", "Глазковский мост"),
        ("sibirskij-moroz", "Сибирский мороз"), ("chaj-s-molokom", "Чай с молоком"), ("kedr", "Кедр")]),
    "vnovgorod": ("ancient kremlin calm, soft gusli-like plucked strings, warm piano, river volkhov, old stones", [
        ("detinets", "Детинец"), ("volhov", "Волхов"), ("berestyanaya-gramota", "Берестяная грамота"),
        ("yaroslavovo-dvorishche", "Ярославово дворище"), ("kokuj", "Кокуй"), ("pesheshodnyj-most", "Пешеходный мост"),
        ("ilmen", "Ильмень"), ("onfim", "Онфим рисует"), ("zima-v-kremle", "Зима в кремле"),
        ("plyazh-u-kremlya", "Пляж у кремля"), ("sbiten", "Сбитень"), ("tuman-nad-volhovom", "Туман над Волховом")]),
    "murmansk": ("polar night, aurora borealis mood, airy pads, soft glassy bells, cold wind, very calm", [
        ("polyarnaya-noch", "Полярная ночь"), ("severnoe-siyanie", "Северное сияние"), ("kolskij-zaliv", "Кольский залив"),
        ("ledokol-lenin", "Ледокол «Ленин»"), ("aleshа", "Алёша над городом"), ("polyarnyj-den", "Полярный день"),
        ("port-v-snegu", "Порт в снегу"), ("teplyj-dom", "Тёплый дом"), ("veter-s-morya", "Ветер с моря"),
        ("sopki", "Сопки"), ("utro-bez-solnca", "Утро без солнца"), ("vozvrashchenie-sveta", "Возвращение света")]),
}

data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
tracks = data["tracks"] if "tracks" in data else data[next(k for k, v in data.items() if isinstance(v, list))]
have = {t["id"] for t in tracks}
rnd = random.Random(20260928)
added = 0
for city, (flavor, titles) in CITIES.items():
    for i, (slug, title) in enumerate(titles, 1):
        tid = f"{city}-{i:02d}-{slug}".replace("а", "a")
        if tid in have:
            continue
        tracks.append({"id": tid, "city": city, "title": title, "tags": f"{BASE}, {flavor}",
                       "bpm": rnd.randint(68, 86), "key": rnd.choice(KEYS), "duration": rnd.choice([150, 165, 180, 195, 210]),
                       "negative": NEG})
        added += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("добавлено", added, "всего", len(tracks))
