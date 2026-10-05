#!/usr/bin/env python3
"""Собирает playlist.json для каждого города в формате проекта «Лофи-города».

Формат (как в site/music/playlist.json):
    [{"src": "music/<file>.mp3", "title": "...", "dur": 204.4}, ...]

Берёт mp3 из out/<city>/<id>-v<N>.mp3 (результат generate.py), выбирает вариант
(по picks.json или первый существующий), копирует его в папку назначения как <id>.mp3,
меряет длительность через ffprobe и пишет <dest>/playlist.json.

Примеры:
    # Петербург — в текущую папку сайта, с сохранением уже лежащих там треков
    python make_playlist.py --city piter --dest "../../site/cities/{city}/music" --merge

    # Все города — в папки по городам
    python make_playlist.py --dest "../../site/cities/{city}/music"

    # Выбор вариантов после прослушивания: picks.json = {"spb-01-utro-na-karpovke": 2, "kazan-05-...": 0}
    # 0 или null — трек не брать.
    python make_playlist.py --city kazan --dest "../../site/cities/{city}/music" --picks picks.json
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def probe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True)
    return round(float(r.stdout.strip()), 1)


def pick_variant(out: Path, t: dict, picks: dict) -> Path | None:
    city_dir = out / t["city"]
    if t["id"] in picks:
        v = picks[t["id"]]
        if not v:
            return None
        f = city_dir / f"{t['id']}-v{int(v)}.mp3"
        if not f.exists():
            print(f"[warn] {f.name} из picks не найден — трек пропущен")
            return None
        return f
    found = sorted(city_dir.glob(f"{t['id']}-v*.mp3"),
                   key=lambda p: int(p.stem.rsplit("-v", 1)[1]) if p.stem.rsplit("-v", 1)[1].isdigit() else 999)
    return found[0] if found else None


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--prompts", default=str(HERE / "prompts.json"))
    p.add_argument("--out", default=str(HERE / "out"), help="папка с результатами generate.py")
    p.add_argument("--city", action="append", help="piter, kazan; по умолчанию все из prompts.json")
    p.add_argument("--dest", default=str(HERE / "out" / "{city}" / "release"),
                   help="куда положить mp3 и playlist.json; {city} подставляется "
                        "(напр. ../../site/music или ../../site/cities/{city}/music)")
    p.add_argument("--src-prefix", default="cities/{city}/music/", help="префикс поля src; {city} подставляется (по умолчанию cities/{city}/music/)")
    p.add_argument("--picks", help="JSON {id: номер варианта | 0/null — не брать}")
    p.add_argument("--merge", action="store_true",
                   help="сохранить в playlist.json уже существующие записи, которых нет в новой партии")
    p.add_argument("--no-copy", action="store_true", help="не копировать mp3, только записать JSON")
    args = p.parse_args()

    if not shutil.which("ffprobe"):
        sys.exit("Нужен ffprobe (входит в ffmpeg).")

    data = json.loads(Path(args.prompts).read_text(encoding="utf-8"))
    tracks = data["tracks"] if isinstance(data, dict) else data
    picks = json.loads(Path(args.picks).read_text(encoding="utf-8")) if args.picks else {}
    out = Path(args.out).expanduser().resolve()
    cities = args.city or sorted({t["city"] for t in tracks})
    prefix = args.src_prefix if args.src_prefix.endswith("/") or not args.src_prefix else args.src_prefix + "/"

    for city in cities:
        dest = Path(args.dest.replace("{city}", city)).expanduser().resolve()
        city_prefix = prefix.replace("{city}", city)
        dest.mkdir(parents=True, exist_ok=True)
        entries = []
        missing = []
        for t in (t for t in tracks if t["city"] == city):
            src = pick_variant(out, t, picks)
            if src is None:
                missing.append(t["id"])
                continue
            target = dest / f"{t['id']}.mp3"
            if not args.no_copy:
                shutil.copy2(src, target)
            measured = target if target.exists() else src
            entries.append({"src": f"{city_prefix}{target.name}", "title": t["title"],
                            "dur": probe_duration(measured)})

        pl_path = dest / "playlist.json"
        if args.merge and pl_path.exists():
            old = json.loads(pl_path.read_text(encoding="utf-8"))
            new_src = {e["src"] for e in entries}
            entries = [e for e in old if e.get("src") not in new_src] + entries

        # Формат как в существующем site/music/playlist.json: по записи на строку.
        body = ",\n".join("  " + json.dumps(e, ensure_ascii=False) for e in entries)
        pl_path.write_text("[\n" + body + "\n]\n", encoding="utf-8")
        total = sum(e["dur"] for e in entries)
        print(f"{city}: {len(entries)} треков, {total / 60:.1f} мин -> {pl_path}")
        if missing:
            print(f"  без mp3 (пропущены): {len(missing)} — {', '.join(missing[:8])}"
                  f"{' …' if len(missing) > 8 else ''}")


if __name__ == "__main__":
    main()
