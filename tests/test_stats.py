"""Вывод tools/stats.py на локальных фикстурах: блок «Удержание» без сервера и ssh.

Запуск: py -3 -m pytest tests/test_stats.py (или python tests/test_stats.py).
Сервер не поднимается: stats.py запускается с HOST=local, STATS_DIR=tests/fixtures. Только стандартная библиотека.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_stats_retention_block():
    env = dict(os.environ, HOST='local', STATS_DIR=os.path.join(ROOT, 'tests', 'fixtures'),
               PYTHONIOENCODING='utf-8')
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'stats.py'), '7'],
                       capture_output=True, env=env, timeout=120)
    out = r.stdout.decode('utf-8')
    print(out)  # виден при запуске с -s: глазами посмотреть блок «Удержание»
    assert r.returncode == 0, (r.returncode, r.stderr.decode('utf-8', 'replace'))
    for key in ('Удержание', 'первый звук', 'ttfs:0-5', 'dur:10m', 'вернулись за 7 дней', 'from=share'):
        assert key in out, f'нет «{key}» в выводе:\n{out}'


if __name__ == '__main__':
    test_stats_retention_block()
    print('PASS stats: блок «Удержание» на месте')
