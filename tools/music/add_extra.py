"""Запасная музыка для всех окон (18): эфир звучал однообразно (у всех треков была одна строка стиля).
Каждому городу — 12 новых треков: та же тема, что у его трека, но в другом поджанре (джазхоп, босса, фортепиано,
вальс, флейта, виолончель…), стили из diversify.py. Пометка "extra": True — gpu_queue/queue2 гонят их в самом конце,
чтобы GPU не простаивал, пока аренда оплачена. Идемпотентно. Запуск: py -3 tools/music/add_extra.py"""
import json
from pathlib import Path

HERE = Path(__file__).parent
STYLES_RU = ["джазхоп", "босса-нова", "фортепиано", "вальс", "флейта", "виолончель", "саксофон", "вибрафон", "гитара",
             "эмбиент", "соул", "синтезатор"]
OLD = ["piter", "kazan", "vladimir", "yaroslavl", "vologda", "krasnodar", "sochi", "nnovgorod", "kaliningrad",
       "vladivostok", "murmansk", "samara", "ekaterinburg", "irkutsk", "vnovgorod", "bam", "anadyr", "transsib"]  # все окна
OLD_BASE = ("lo-fi hip hop, instrumental, chill beat, jazzy chords, warm Rhodes piano, dusty vinyl crackle, "
            "tape saturation, soft boom bap drums, mellow bassline, cozy, relaxed")

src = (HERE / "diversify.py").read_text(encoding="utf-8")
ns = {}
exec(src[src.index("COMMON ="):src.index("OLD_BASE =")], ns)  # COMMON и STYLES без запуска переписывания
COMMON, STYLES = ns["COMMON"], ns["STYLES"]

data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
have = {t["id"] for t in data["tracks"]}
added = 0
for city in OLD:
    base = [t for t in data["tracks"] if t["city"] == city and not t.get("night") and not t.get("vocal") and not t.get("extra")][:12]
    for k, t in enumerate(base):
        style, (lo, hi), ts = STYLES[k % len(STYLES)]
        tid = f"{t['id']}-x{k + 1:02d}"
        if tid in have:
            continue
        flavor = t["tags"][len(OLD_BASE) + 2:] if t["tags"].startswith(OLD_BASE) else t.get("flavor", "")
        data["tracks"].append({
            "id": tid, "city": city, "title": f"{t['title']} · {STYLES_RU[k % len(STYLES_RU)]}",
            "tags": f"{COMMON}, {style}" + (f", {flavor}" if flavor else ""),
            "bpm": lo + (k * 7) % (hi - lo + 1), "key": t["key"], "duration": t["duration"], "ts": ts,
            "negative": t.get("negative", ""), "extra": True, "flavor": flavor,
        })
        added += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("добавлено запасных треков:", added)
