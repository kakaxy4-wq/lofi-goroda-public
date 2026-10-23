"""Разнообразие эфира: треки звучали похоже, потому что у всех была одна строка стиля.
Переписывает теги ещё НЕ сгенерированных треков (нет папки music/final/<город> или нет файла трека):
каждому — свой поджанр лоу-фая (джазхоп, босса, соло фортепиано, вальс 3/4, флейта, виолончель…)
и свой темп из диапазона поджанра; городской акцент (последняя часть тегов) сохраняется.
Ночные и вокальные треки не трогаем. Идемпотентно (поджанр по хешу id).
Запуск: py -3 tools/music/diversify.py"""
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).parent
FINAL = HERE.parent.parent / "music" / "final"
COMMON = "lo-fi, instrumental, chill, dusty vinyl crackle, tape saturation, cozy, warm mix"
STYLES = [  # (поджанр, диапазон темпа, размер)
    ("jazzhop, upright bass, brushed drums, muted trumpet, Rhodes piano, swing feel", (78, 90), "4"),
    ("bossa nova lofi, nylon string guitar, soft shaker, gentle bossa groove, light percussion", (84, 96), "4"),
    ("solo felt piano lofi, intimate piano melody, soft kick, tape hiss, sparse arrangement", (64, 76), "4"),
    ("lofi waltz, accordion melody, music box, upright bass, gentle 3/4 sway", (66, 80), "3"),
    ("flute lofi, wooden flute melody, kalimba, soft hand percussion, airy", (72, 84), "4"),
    ("cello lofi, warm cello melody, pizzicato strings, soft boom bap", (68, 80), "4"),
    ("late night saxophone lofi, mellow tenor sax, smoky chords, slow groove", (70, 82), "4"),
    ("vibraphone lofi, vibraphone melody, double bass, light swing drums", (76, 88), "4"),
    ("chillhop guitar, clean electric guitar licks, funky bassline, crisp snare", (84, 94), "4"),
    ("ambient lofi, slow evolving pads, soft drums, distant field recording texture", (60, 72), "4"),
    ("soul lofi, warm organ, soulful chords, laid-back swing drums", (76, 88), "4"),
    ("analog synth lofi, warm retro synth lead, soft pads, gentle drums", (74, 86), "4"),
]
OLD_BASE = ("lo-fi hip hop, instrumental, chill beat, jazzy chords, warm Rhodes piano, dusty vinyl crackle, "
            "tape saturation, soft boom bap drums, mellow bassline, cozy, relaxed")


def generated(t):
    d = FINAL / t["city"]
    return d.exists() and any(f.startswith(t["id"]) for f in os.listdir(d))


data = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
changed = 0
for t in data["tracks"]:
    if t.get("night") or t.get("vocal") or generated(t):
        continue
    h = int(hashlib.md5(t["id"].encode()).hexdigest(), 16)
    style, (lo, hi), ts = STYLES[h % len(STYLES)]
    flavor = t["tags"][len(OLD_BASE) + 2:] if t["tags"].startswith(OLD_BASE) else t.get("flavor", "")
    t["flavor"] = flavor
    t["tags"] = f"{COMMON}, {style}" + (f", {flavor}" if flavor else "")
    t["bpm"] = lo + (h >> 8) % (hi - lo + 1)
    t["ts"] = ts
    changed += 1
(HERE / "prompts.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("переписано треков:", changed)
