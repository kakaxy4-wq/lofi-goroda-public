"""Проставляет темп (bpm), тональность (key) и пометки night/vocal в плейлисты городов из описаний генерации (tools/music/prompts.json):
ночной эфир (1:00–6:00 по местному времени) собирается из медленных треков. Идемпотентно;
вызывается из tools/build_pages.py перед каждой выкладкой."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', '..', 'site', 'cities')


def run():
    prompts = {t['id']: t for t in json.load(open(os.path.join(HERE, 'prompts.json'), encoding='utf-8'))['tracks']}
    bpm = {k: t['bpm'] for k, t in prompts.items()}
    changed = 0
    for city in os.listdir(SITE):
        p = os.path.join(SITE, city, 'music', 'playlist.json')
        if not os.path.exists(p):
            continue
        pl = json.load(open(p, encoding='utf-8'))
        dirty = False
        for t in pl:
            tid = os.path.basename(t['src']).rsplit('.', 1)[0]
            tid = tid if tid in bpm else tid.rsplit('-v', 1)[0]
            if tid in bpm and t.get('bpm') != bpm[tid]:
                t['bpm'] = bpm[tid]
                dirty = True
            key = prompts.get(tid, {}).get('key')  # тональность — для гитары на стене (аккорды в тон эфира)
            if key and t.get('key') != key:
                t['key'] = key
                dirty = True
            for flag in ('night', 'vocal'):  # ночные треки — только ночью; с голосом — помечены для плеера
                if tid in prompts and prompts[tid].get(flag) and not t.get(flag):
                    t[flag] = True
                    dirty = True
        if dirty:
            open(p, 'w', encoding='utf-8', newline='\n').write('[\n' + ',\n'.join('  ' + json.dumps(t, ensure_ascii=False) for t in pl) + '\n]\n')
            changed += 1
    return changed


if __name__ == '__main__':
    print('плейлистов обновлено:', run())
