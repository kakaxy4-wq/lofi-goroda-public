"""Промо-ролики Лофи-городов из покадровой записи сцены (480×270 → 1920×1080 без размытия)."""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
from fontTools.ttLib import TTFont

FF = imageio_ffmpeg.get_ffmpeg_exe()
SP = Path(__file__).parent
FR = SP / "og"
OUT = SP / "promo"
OUT.mkdir(exist_ok=True)
REPO = Path(r"C:\Users\ВТБ\Documents\Проекты\Радио")

# шрифт для подписей: Pangolin (OFL) woff2 -> ttf, кириллица + латиница вместе
font = SP / "pangolin.ttf"
if not font.exists():
    f = TTFont(REPO / "site" / "fonts" / "pangolin-cyr.woff2"); f.flavor = None
    lat = TTFont(REPO / "site" / "fonts" / "pangolin-lat.woff2")
    # кириллического подмножества хватает для подписей; цифры/точки/латиница — из латинского
    from fontTools.merge import Merger
    lat.flavor = None
    lat.save(SP / "_lat.ttf"); f.save(SP / "_cyr.ttf")
    Merger().merge([str(SP / "_lat.ttf"), str(SP / "_cyr.ttf")]).save(font)
FONT = "pangolin.ttf"  # ffmpeg запускается из папки SP: путь без двоеточий и экранирования

CLIPS = [  # id, подпись, трек
    ("kazan", "Казань", "kazan-01"),
    ("piter", "Санкт-Петербург", "spb-02"),
    ("murmansk", "Мурманск", "murmansk-02"),
    ("vladivostok", "Владивосток", "vladivostok-12"),
    ("vologda", "Вологда", "vologda-04"),
    ("sochi", "Сочи", "sochi-02"),
]
LIB = REPO / "music" / "final"


def track(city, prefix):
    hits = sorted((LIB / city).glob(f"{prefix}*.mp3")) or sorted((LIB / city).glob("*.mp3"))
    return hits[0]


def text(t, size, x, y, alpha=1):
    t = t.replace(":", "\\:").replace("'", "\u2019")
    return (f"drawtext=fontfile='{FONT}':text='{t}':fontsize={size}:fontcolor=0xf3e6c8@{alpha}:"
            f"shadowcolor=0x000000@0.8:shadowx=4:shadowy=4:x={x}:y={y}")


def run(args):
    r = subprocess.run([FF, "-y", "-loglevel", "error", *args], capture_output=True, text=True, cwd=SP)
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])


SCALE = "scale=1920:1080:flags=neighbor"
for cid, name, pref in CLIPS:
    mp3 = track(cid, pref)
    vf = ",".join([SCALE, text(name, 64, 60, "h-150"), text(f"lofi-goroda.ru/{cid}/", 40, "w-tw-60", "h-120", 0.9),
                   "fade=in:0:15", "fade=out:st=7.4:d=0.6"])
    run(["-framerate", "30", "-i", str(FR / f"clip_{cid}_%04d.png"), "-ss", "20", "-i", str(mp3),
         "-vf", vf, "-af", "afade=in:st=0:d=1,afade=out:st=7:d=1", "-t", "8",
         "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", str(OUT / f"lofi-{cid}.mp4")])
    print("ok", cid, mp3.name)

# подборка: 6 сцен по 8 с с подписями + заставка 3 с, звук — один трек на весь ролик
parts = []
for cid, name, _ in CLIPS:
    p = OUT / f"_part_{cid}.mp4"
    vf = ",".join([SCALE, text(name, 64, 60, "h-150"), "fade=in:0:12", "fade=out:st=7.6:d=0.4"])
    run(["-framerate", "30", "-i", str(FR / f"clip_{cid}_%04d.png"), "-vf", vf, "-t", "8",
         "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", str(p)])
    parts.append(p)
end = OUT / "_part_end.mp4"
vf = ",".join([text("Лофи-города", 110, "(w-tw)/2", "h/2-140"),
               text("живое окно в 15 городов России", 48, "(w-tw)/2", "h/2+10", 0.9),
               text("lofi-goroda.ru", 72, "(w-tw)/2", "h/2+100"), "fade=in:0:12"])
run(["-f", "lavfi", "-i", "color=c=0x140e12:s=1920x1080:r=30:d=3.5", "-vf", vf,
     "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-an", str(end)])
parts.append(end)
lst = OUT / "_list.txt"
lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
silent = OUT / "_montage_silent.mp4"
run(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)])
total = 8 * len(CLIPS) + 3.5
music = track("kazan", "kazan-05")
run(["-i", str(silent), "-ss", "15", "-i", str(music), "-map", "0:v", "-map", "1:a", "-t", str(total),
     "-af", f"afade=in:st=0:d=1.5,afade=out:st={total - 2.5}:d=2.5", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
     "-movflags", "+faststart", str(OUT / "lofi-goroda-promo.mp4")])
for p in parts + [lst, silent]:
    p.unlink()
print("ok montage", music.name)
for f in sorted(OUT.glob("*.mp4")):
    print(f.name, round(f.stat().st_size / 1e6, 1), "MB")
