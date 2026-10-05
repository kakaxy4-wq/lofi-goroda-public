"""Раскладывает сгенерированные треки по сайту: mp3 -> site/cities/<city>/music/<id>.mp3,
плейлист -> site/cities/<city>/music/playlist.json (уже лежащие там записи, например треки Suno, сохраняются).

Длительности меряет make_playlist.py на GPU-сервере (там есть ffprobe), здесь только копирование:
    python tools/music/install_release.py --host root@<gpu-host> piter kazan ...
mp3 в git не попадают (.gitignore), на VPS их отдельно докачивает deploy/sync_music.sh."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument("cities", nargs="+")
p.add_argument("--host", default=os.environ.get("GPU_HOST", ""), help="ssh-хост GPU-сервера, если плейлиста нет локально")
p.add_argument("--remote", default="/root/music/pl/{city}/playlist.json")
p.add_argument("--library", default=str(ROOT / "music" / "final"), help="скачанные out-final/<city>/<id>-v1.mp3")
args = p.parse_args()

for city in args.cities:
    local = ROOT / "music" / "pl" / city / "playlist.json"   # сохранённый плейлист с длительностями (GPU-сервер уже не нужен)
    if local.exists():
        raw = local.read_text(encoding="utf-8")
    else:
        raw = subprocess.run(["ssh", "-o", "BatchMode=yes", args.host, "cat " + args.remote.format(city=city)],
                             capture_output=True, check=True).stdout.decode("utf-8")
    new = json.loads(raw)
    dest = ROOT / "site" / "cities" / city / "music"
    dest.mkdir(parents=True, exist_ok=True)
    for e in new:
        name = Path(e["src"]).name                       # <id>.mp3
        src = Path(args.library) / city / name.replace(".mp3", "-v1.mp3")
        if not src.exists():
            raise SystemExit(f"нет файла {src} — сначала скачайте out-final")
        shutil.copy2(src, dest / name)
    pl = dest / "playlist.json"
    old = json.loads(pl.read_text(encoding="utf-8")) if pl.exists() else []
    srcs = {e["src"] for e in new}
    merged = [e for e in old if e["src"] not in srcs] + new
    pl.write_text("[\n" + ",\n".join("  " + json.dumps(e, ensure_ascii=False) for e in merged) + "\n]\n", encoding="utf-8")
    print(f"{city}: {len(merged)} треков ({len(new)} новых), {sum(e['dur'] for e in merged) / 60:.0f} мин")
