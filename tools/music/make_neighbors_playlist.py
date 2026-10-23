"""Плейлист окна без своих треков — из треков соседних окон, с подписью, откуда трек: «Набережная Казанки · Казань».
Разные треки (не две версии одного), без вокала, только с сеткой долей (гитара у окна). Детерминированно.
Запуск: py -3 tools/music/make_neighbors_playlist.py izhevsk kazan,ekaterinburg,samara,nnovgorod [дневных=5] [ночных=2]"""
import json
import os
import re
import sys

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site')


def main(city, sources, n_day=5, n_night=2):
    names = {c['id']: c['name'] for c in json.load(open(os.path.join(SITE, 'cities', 'index.json'), encoding='utf-8'))}
    out = []
    for src in sources:
        pl = [t for t in json.load(open(os.path.join(SITE, 'cities', src, 'music', 'playlist.json'), encoding='utf-8')) if not t.get('vocal') and t.get('beat')]

        def pick(ts, n):
            got, seen = [], set()
            for t in sorted(ts, key=lambda t: t['src']):
                base = re.sub(r'-x\d+$', '', os.path.basename(t['src']).rsplit('.', 1)[0])
                if base not in seen:
                    seen.add(base); got.append(t)
            step = max(1, len(got) // n) if got else 1  # равномерно по всему плейлисту источника
            return got[::step][:n]

        for t in pick([t for t in pl if not t.get('night')], n_day) + pick([t for t in pl if t.get('night')], n_night):
            out.append({**t, 'title': f"{t['title']} · {names.get(src, src)}"})
    dst = os.path.join(SITE, 'cities', city, 'music')
    os.makedirs(dst, exist_ok=True)
    with open(os.path.join(dst, 'playlist.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps(t, ensure_ascii=False) for t in out) + '\n]\n')
    print('треков:', len(out), 'ночных:', sum(1 for t in out if t.get('night')))


if __name__ == '__main__':
    a = sys.argv[1:]
    main(a[0], a[1].split(','), *(int(x) for x in a[2:4]))
