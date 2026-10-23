# Добавить окно в tools/stories_data.json по его модулю (cities/<id>/index.js): py -3 tools/add_story.py <id> <после какого окна>
import json, re, sys
cid, after = sys.argv[1], sys.argv[2]
src = open(f'site/cities/{cid}/index.js', encoding='utf-8').read()
pl = json.load(open(f'site/cities/{cid}/music/playlist.json', encoding='utf-8'))
idx = [c for c in json.load(open('site/cities/index.json', encoding='utf-8')) if c['id'] == cid][0]
cfg = lambda k: re.search(k + r": '(.*?)',", src).group(1)
places_src = re.search(r'const PLACES = (\{.*?\n\});', src, re.S).group(1)
places = {}
for m in re.finditer(r"  (\w+): \{ name: '(.*?)', fact: '(.*?)'(, inScene: true)?(?:, soon: '(.*?)')? \},", places_src):
    places[m.group(1)] = {'name': m.group(2), 'fact': m.group(3), 'inScene': bool(m.group(4)), 'soon': m.group(5) or ''}
order = re.findall(r"'(\w+)'", re.search(r'const PLACE_ORDER = \[(.*?)\];', src).group(1))
assert set(order) == set(places), set(order) ^ set(places)
e = {'id': cid, 'name': idx['name'], 'nameGen': idx['nameGen'], 'subtitle': cfg('subtitle'), 'radioName': cfg('radioName'),
     'title': idx['title'], 'description': idx['description'], 'og': idx['og'], 'about': re.search(r'about: `(.*?)`,', src, re.S).group(1),
     'places': [{'id': k, **places[k]} for k in order],
     'sounds': [{'name': a, 'hint': b} for a, b in re.findall(r"\{ id: '\w+', name: '(.*?)', hint: '(.*?)' \}", src)],
     'tracks': [t['title'] for t in pl if not t.get('night')],
     'secrets': len(re.findall(r"^    id: '", open(f'site/cities/{cid}/skyline.js', encoding='utf-8').read(), re.M)), 'utc': idx['utc']}
p = 'tools/stories_data.json'; d = [c for c in json.load(open(p, encoding='utf-8')) if c['id'] != cid]
d.insert([c['id'] for c in d].index(after) + 1, e)
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
print(len(e['places']), len(e['sounds']), len(e['tracks']), e['secrets'])
