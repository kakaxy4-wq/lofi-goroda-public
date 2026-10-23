"""Плейлист Москвы, пока у неё нет своих треков: «все дороги ведут в Москву» — лучшее из других окон.

Из каждого города берём по два дневных трека с самым «столичным» звучанием (джаз, сити-поп, Rhodes —
по тегам из prompts.json) и по одному ночному. В названии — откуда трек: «Утро на Карповке · Санкт-Петербург».
Поля bpm, key, beat переносятся как есть (гитара у окна, ночной эфир). Детерминированно; запуск:
py -3 tools/music/make_moskva_playlist.py"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', '..', 'site')
SKIP = {'moskva', 'doroga'}  # у «Марсохода» эфир — треки Транссиба, второй раз не берём
CAPITAL = ('jazz', 'city pop', 'rhodes', 'saxophone', 'piano', 'brass')


def main():
    prompts = {t['id']: t for t in json.load(open(os.path.join(HERE, 'prompts.json'), encoding='utf-8'))['tracks']}
    cities = json.load(open(os.path.join(SITE, 'cities', 'index.json'), encoding='utf-8'))
    out = []
    for c in cities:
        if not c.get('enabled') or c['id'] in SKIP:
            continue
        p = os.path.join(SITE, 'cities', c['id'], 'music', 'playlist.json')
        if not os.path.exists(p):
            continue
        pl = [t for t in json.load(open(p, encoding='utf-8')) if not t.get('vocal') and t.get('beat')]

        def score(t):
            tid = os.path.basename(t['src']).rsplit('.', 1)[0]
            tags = (prompts.get(tid) or prompts.get(tid.rsplit('-x', 1)[0]) or {}).get('tags', '').lower()
            return (-sum(k in tags for k in CAPITAL), t['src'])

        def pick(ts, n):  # разные треки, а не две версии одного (spb-01 и spb-01-x01)
            got, seen = [], set()
            for t in sorted(ts, key=score):
                base = re.sub(r'-x\d+$', '', os.path.basename(t['src']).rsplit('.', 1)[0])
                if base not in seen:
                    seen.add(base); got.append(t)
            return got[:n]

        day = pick([t for t in pl if not t.get('night')], 2)
        night = pick([t for t in pl if t.get('night')], 1)
        for t in day + night:
            out.append({**t, 'title': f"{t['title']} · {c['name']}"})
    dst = os.path.join(SITE, 'cities', 'moskva', 'music')
    os.makedirs(dst, exist_ok=True)
    with open(os.path.join(dst, 'playlist.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps(t, ensure_ascii=False) for t in out) + '\n]\n')
    print('треков:', len(out), 'из них ночных:', sum(1 for t in out if t.get('night')))


if __name__ == '__main__':
    main()
