"""Раскладка музыки после аренды GPU без сервера: WAV из music/gpu-<дата>/<city>/ → mp3 (loudnorm I=-16, TP -1.5,
фейды 2 с, 128k — как postprocess в generate.py) → site/cities/<city>/music/<id>.mp3 + playlist.json.
ffmpeg берётся из imageio-ffmpeg (pip), ffprobe не нужен: длительность — из WAV.
Песни с голосом (vocal) в эфир не ставим — для них будет «Живая волна». Плейлист города пересобирается из всех
его треков: старые записи с тем же src обновляются, остальные сохраняются (у БАМа и Анадыря — заменяются целиком,
там была временная копия эфира Владивостока).
Запуск: py -3 tools/music/install_local.py music/gpu-2026-10-10 samara ekaterinburg ...  (без городов — все папки)"""
import json
import subprocess
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / sys.argv[1]
CITIES = sys.argv[2:] or sorted(p.name for p in SRC.iterdir() if p.is_dir() and (ROOT / 'site' / 'cities' / p.name).exists())
REPLACE = {'bam', 'anadyr', 'transsib'}  # временные копии чужого эфира — заменить целиком
prompts = {t['id']: t for t in json.load(open(ROOT / 'tools' / 'music' / 'prompts.json', encoding='utf-8'))['tracks']}


def dur_of(wav: Path) -> float:
    with wave.open(str(wav)) as w:
        return w.getnframes() / w.getframerate()


def to_mp3(wav: Path, mp3: Path) -> None:
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', str(wav), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
                        '-f', 'null', '-'], capture_output=True, text=True)
    e = r.stderr; m = json.loads(e[e.rfind('{'):e.rfind('}') + 1])
    d = dur_of(wav)
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
          f"afade=t=in:st=0:d=2,afade=t=out:st={max(0, d - 2):.3f}:d=2")
    tmp = mp3.with_suffix('.tmp.mp3')
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-af', af, '-ar', '44100', '-ac', '2',
                    '-codec:a', 'libmp3lame', '-b:a', '128k', str(tmp)], check=True)
    tmp.replace(mp3)


for city in CITIES:
    jobs = []
    for wav in sorted((SRC / city).glob('*-v1.wav')):
        tid = wav.name[:-len('-v1.wav')]
        t = prompts.get(tid)
        if not t or t.get('vocal'):
            continue
        jobs.append((wav, tid, t))
    dest = ROOT / 'site' / 'cities' / city / 'music'
    dest.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(4) as ex:
        # уже собранные mp3 (новее своего WAV) не пересобираем — повторный запуск быстрый
        list(ex.map(lambda j: None if (dest / f'{j[1]}.mp3').exists() and (dest / f'{j[1]}.mp3').stat().st_mtime > j[0].stat().st_mtime else to_mp3(j[0], dest / f'{j[1]}.mp3'), jobs))
    entries = []
    for wav, tid, t in jobs:
        e = {'src': f'cities/{city}/music/{tid}.mp3', 'title': t['title'], 'dur': round(dur_of(wav), 1), 'bpm': t['bpm']}
        if t.get('night'):
            e['night'] = True
        entries.append(e)
    pl = dest / 'playlist.json'
    old = [] if city in REPLACE or not pl.exists() else json.load(open(pl, encoding='utf-8'))
    # порядок: прежние (обновлённые на месте), затем новые
    by_src = {e['src']: e for e in entries}
    merged = [by_src.pop(e['src'], e) for e in old] + list(by_src.values())
    pl.write_text('[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in merged) + '\n]\n', encoding='utf-8')
    print(city, 'треков в эфире:', len(merged), '(новых/обновлённых:', len(entries), ')', flush=True)
