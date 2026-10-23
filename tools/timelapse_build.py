#!/usr/bin/env python3
"""Склейка таймлапса «Марсохода»: 9 000 км за 3 минуты.

  py -3 tools/timelapse_build.py                      скачать кадры с сервера и собрать music/timelapse/marsokhod.mp4
  py -3 tools/timelapse_build.py --no-download        собрать из уже лежащих кадров (то же: --skip-download)
  py -3 tools/timelapse_build.py --frames DIR --out FILE --seconds 180 --no-audio

Кадры бот снимает раз в 10 минут в /data/timelapse/YYYYMMDD-HHMM.jpg (том lofi-bot-data, контейнер lofi-goroda-bot-1, хост myvps2).
Нужен: pip install imageio-ffmpeg (бинарник ffmpeg внутри пакета; системный ffmpeg не нужен).
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'myvps2'
CONTAINER = 'lofi-goroda-bot-1'
FRAME_RE = re.compile(r'^\d{8}-\d{4}\.(jpg|png)$')
W, H = 1280, 720
FPS_MIN, FPS_MAX = 12, 30
INTRO_S, OUTRO_S = 3.0, 4.0
CROSSFADE = 3.0
TITLE_1 = 'Марсоход: Владивосток — Москва'
TITLE_2 = '9 000 км за 3 минуты · «Грузин на Марсе» × Лофи-города'
OUTRO_1 = 'Доехали!'
OUTRO_2 = 'lofi-goroda.ru/doroga'

# волны радио (site/cities/doroga/radio.js): id города и участок маршрута в км — доля эфира пропорциональна длине участка
WAVES = [('vladivostok', 0, 700), ('bam', 700, 3400), ('irkutsk', 3400, 4500), ('transsib', 4500, 7300),
         ('ekaterinburg', 7300, 8100), ('kazan', 8100, 8700), ('nnovgorod', 8700, 9000), ('vladimir', 9000, 9400)]


def ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('Нет imageio-ffmpeg: pip install imageio-ffmpeg')


def ssh_base():
    """Как deploy/ssh_env.sh: в Windows путь профиля с кириллицей ломает ~/.ssh/config — даём ssh короткий путь 8.3."""
    cmd = ['ssh']
    if os.name == 'nt':
        try:
            import ctypes
            home = os.path.expanduser('~')
            buf = ctypes.create_unicode_buffer(1024)
            if ctypes.windll.kernel32.GetShortPathNameW(home, buf, 1024):
                cmd += ['-F', buf.value + '\\.ssh\\config', '-o', 'UserKnownHostsFile=' + buf.value + '\\.ssh\\known_hosts']
        except Exception:
            pass
    return cmd


def download(dest):
    """Тянем tar из контейнера и распаковываем только файлы-кадры (имена из потока — недоверенные данные)."""
    os.makedirs(dest, exist_ok=True)
    cmd = ssh_base() + [HOST, f'docker exec {CONTAINER} tar -C /data/timelapse -cf - .']
    print('Скачиваю кадры с', HOST, '…')
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = 0
    try:
        with tarfile.open(fileobj=p.stdout, mode='r|') as tf:
            for m in tf:
                name = os.path.basename(m.name)
                if not m.isfile() or not FRAME_RE.match(name):
                    continue
                with tf.extractfile(m) as src, open(os.path.join(dest, name), 'wb') as out:
                    shutil.copyfileobj(src, out)
                n += 1
    except tarfile.ReadError as e:
        p.kill()
        sys.exit(f'Не удалось прочитать tar с сервера ({e}). Папки /data/timelapse может ещё не быть.')
    p.wait()
    if p.returncode not in (0, None) and n == 0:
        sys.exit(f'ssh/docker вернул код {p.returncode}, кадров нет')
    print(f'Скачано кадров: {n}')


def list_frames(d):
    try:
        return sorted(f for f in os.listdir(d) if FRAME_RE.match(f))
    except OSError:
        return []


def pick_fps(n, seconds):
    return max(FPS_MIN, min(FPS_MAX, n / seconds))


def audio_tracks():
    """По одному треку на волну (первый основной, без «-xNN» вариантов); нет файлов — [] и предупреждение."""
    out = []
    for cid, a, b in WAVES:
        d = os.path.join(ROOT, 'site', 'cities', cid, 'music')
        files = sorted(f for f in (os.listdir(d) if os.path.isdir(d) else []) if f.lower().endswith('.mp3'))
        main = [f for f in files if not re.search(r'-x\d+\.mp3$', f, re.I)] or files
        if not main:
            return []
        out.append((os.path.join(d, main[0]), b - a))
    return out


def find_font():
    for p in (r'C:\Windows\Fonts\arial.ttf', r'C:\Windows\Fonts\segoeui.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
              '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'):
        if os.path.exists(p):
            return p
    return None


def build(frames_dir, out, seconds, with_audio):
    ff = ffmpeg_exe()
    names = list_frames(frames_dir)
    if not names:
        sys.exit(f'В {frames_dir} нет кадров YYYYMMDD-HHMM.jpg/png')
    n = len(names)
    fps = pick_fps(n, seconds)
    dur = n / fps
    print(f'Кадров {n}, {fps:.2f} к/с, длительность {dur:.1f} с')

    work = tempfile.mkdtemp(prefix='tlbuild-')
    try:
        # список кадров для concat: абсолютные пути, прямые слэши
        with open(os.path.join(work, 'list.txt'), 'w', encoding='utf-8') as f:
            for nm in names:
                p = os.path.abspath(os.path.join(frames_dir, nm)).replace('\\', '/').replace("'", "'\\''")
                f.write(f"file '{p}'\nduration {1 / fps:.6f}\n")
            f.write(f"file '{p}'\n")  # concat игнорирует duration последнего файла — повторяем его
        # видеофильтр; шрифт и тексты кладём в work и работаем в нём (без экранирования путей с двоеточием)
        vf = [f'scale={W}:{H}:force_original_aspect_ratio=decrease', f'pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black', 'setsar=1', 'scale=out_range=tv', 'format=yuv420p']  # JPEG — full range, приводим к tv (иначе yuvj420p)
        font = find_font()
        if font:
            shutil.copy(font, os.path.join(work, 'font.ttf'))
            intro_end, outro_start = min(INTRO_S, dur / 3), max(dur - OUTRO_S, dur * 2 / 3)
            for i, (txt, size, y, t0, t1) in enumerate([(TITLE_1, 56, 'h*0.40', 0, intro_end), (TITLE_2, 34, 'h*0.40+80', 0, intro_end),
                                                        (OUTRO_1, 80, 'h*0.38', outro_start, dur + 1), (OUTRO_2, 48, 'h*0.38+110', outro_start, dur + 1)]):
                with open(os.path.join(work, f't{i}.txt'), 'w', encoding='utf-8') as f:
                    f.write(txt)
                vf.append(f"drawtext=fontfile=font.ttf:textfile=t{i}.txt:fontsize={size}:fontcolor=white:x=(w-text_w)/2:y={y}:"
                          f"box=1:boxcolor=black@0.55:boxborderw=18:enable='between(t,{t0:.2f},{t1:.2f})'")
        else:
            print('ПРЕДУПРЕЖДЕНИЕ: шрифт не найден (нужен arial.ttf), титров не будет')

        cmd = [ff, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt']
        tracks = audio_tracks() if with_audio else []
        if with_audio and not tracks:
            print('ПРЕДУПРЕЖДЕНИЕ: mp3 в site/cities/<город>/music/ нет — видео будет без звука')
        fc = ['[0:v]' + ','.join(vf) + '[v]']
        if tracks:
            total = sum(km for _, km in tracks)
            for i, (path, km) in enumerate(tracks):
                cmd += ['-stream_loop', '-1', '-i', path]
                seg = max(dur * km / total, 6.0) + CROSSFADE
                fc.append(f'[{i + 1}:a]atrim=0:{seg:.2f},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a{i}]')
            prev = 'a0'
            for i in range(1, len(tracks)):
                fc.append(f'[{prev}][a{i}]acrossfade=d={CROSSFADE}:c1=tri:c2=tri[x{i}]')
                prev = f'x{i}'
            fo = min(3.0, dur / 4)
            fc.append(f'[{prev}]atrim=0:{dur:.2f},afade=t=in:st=0:d=2,afade=t=out:st={max(dur - fo, 0):.2f}:d={fo:.2f}[a]')
        cmd += ['-filter_complex', ';'.join(fc), '-map', '[v]']
        if tracks:
            cmd += ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k']
        cmd += ['-r', f'{fps:.3f}', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                '-t', f'{dur:.2f}', os.path.abspath(out)]
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        print('ffmpeg …')
        r = subprocess.run(cmd, cwd=work)
        if r.returncode:
            sys.exit(f'ffmpeg вернул код {r.returncode}')
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print(f'Готово: {out} ({os.path.getsize(out) / 1e6:.1f} МБ, {dur:.1f} с, звук: {"да" if tracks else "нет"})')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--frames', default=os.path.join(ROOT, 'music', 'timelapse-frames'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'music', 'timelapse', 'marsokhod.mp4'))
    ap.add_argument('--seconds', type=float, default=180)
    ap.add_argument('--no-audio', action='store_true')
    ap.add_argument('--no-download', '--skip-download', dest='no_download', action='store_true')
    a = ap.parse_args()
    if not a.no_download:
        download(a.frames)
    build(a.frames, a.out, a.seconds, not a.no_audio)


if __name__ == '__main__':
    main()
