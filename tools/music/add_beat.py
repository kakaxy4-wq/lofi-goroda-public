"""Сетка долей треков для гитары на стене (engine/guitar.js): «beat": время каждой 8-й доли в секундах.

Темп из prompts.json — заказанный, а не настоящий (78 против 78,3), и внутри трека он ещё и плавает:
одна прямая «доля № n = a + n·P» расходится с треком на четверть доли. Поэтому доли меряем по самому mp3
(librosa) и храним опорные точки через 8 долей; между ними клиент считает долю линейно.
Пишет поле beat в site/cities/*/music/playlist.json; уже размеченные треки пропускает.
Запуск: py -3 tools/music/add_beat.py [процессов=4]. Нужны librosa и mp3 треков на диске (deploy/sync_music.sh)."""
import glob
import json
import os
import sys
import warnings
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', '..', 'site')


def grid(path, bpm):
    import librosa
    import numpy as np
    warnings.filterwarnings('ignore')
    y, sr = librosa.load(path, sr=22050, mono=True)
    env = librosa.onset.onset_strength(y=y, sr=sr)
    _, beats = librosa.beat.beat_track(onset_envelope=env, sr=sr, start_bpm=bpm or 80, tightness=300, units='time')
    if len(beats) < 16:
        return None
    d = np.diff(beats)
    p0 = float(np.median(d))
    if (np.abs(d - p0) > 0.12 * p0).mean() > 0.05:  # трекер сбивался (пропуски, полудоли) — сетке не верим
        return None
    anchors = beats[::8]
    # проверка: доли между опорами — линейно; заметно мимо — сетке не верим
    idx = np.arange(len(beats))
    est = np.interp(idx, idx[::8], anchors) if len(anchors) > 1 else beats
    if float(np.median(np.abs(est - beats))) > 0.03:
        return None
    return [round(float(x), 3) for x in anchors]


def job(args):
    src, bpm = args
    try:
        return src, grid(os.path.join(SITE, src), bpm)
    except Exception as e:  # битый файл — без сетки, гитара просто не подтягивает удар
        print('ошибка', src, e, flush=True)
        return src, None


def main():
    procs = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    lists = sorted(glob.glob(os.path.join(SITE, 'cities', '*', 'music', 'playlist.json')))
    todo = {}
    for p in lists:
        for t in json.load(open(p, encoding='utf-8')):
            if 'beat' not in t and os.path.exists(os.path.join(SITE, t['src'])):
                todo[t['src']] = t.get('bpm')
    print('треков к разметке:', len(todo), flush=True)
    done = {}
    with ProcessPoolExecutor(procs) as ex:
        for i, (src, g) in enumerate(ex.map(job, todo.items(), chunksize=4)):
            done[src] = g
            if i % 25 == 0:
                print(i, src, g, flush=True)
    for p in lists:
        pl = json.load(open(p, encoding='utf-8'))
        dirty = False
        for t in pl:
            if t['src'] in done:
                t['beat'] = done[t['src']]  # None — меряли, сетки нет; второй раз не меряем
                dirty = True
        if dirty:
            open(p, 'w', encoding='utf-8', newline='\n').write('[\n' + ',\n'.join('  ' + json.dumps(t, ensure_ascii=False) for t in pl) + '\n]\n')
    print('готово:', sum(1 for g in done.values() if g), 'с сеткой из', len(done))


if __name__ == '__main__':
    main()
