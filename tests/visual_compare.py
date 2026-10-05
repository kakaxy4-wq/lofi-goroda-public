"""Попиксельное сравнение снимков сцены: python tests/visual_compare.py <папка> <префикс_А> <префикс_Б>
Печатает число отличающихся пикселей по каждому случаю; код выхода 1, если где-то есть отличия."""
import json
import os
import sys

from PIL import Image, ImageChops

folder, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
cases = json.load(open(os.path.join(os.path.dirname(__file__), 'visual_cases.json'), encoding='utf-8'))
bad = 0
for c in cases:
    pa, pb = os.path.join(folder, f"{a}-{c['name']}.png"), os.path.join(folder, f"{b}-{c['name']}.png")
    A, B = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
    diff = ImageChops.difference(A, B)
    n = sum(1 for px in diff.getdata() if px != (0, 0, 0))
    if n:
        bad += 1
        diff.point(lambda v: 255 if v else 0).save(os.path.join(folder, f"diff-{c['name']}.png"))
    print(f"{c['name']:14s} {'OK' if n == 0 else f'отличается {n} px'} ")
sys.exit(1 if bad else 0)
