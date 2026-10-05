"""Локальный сервер для разработки: сайт с корня (как на проде), тесты — по /tests/.
Запуск: python tools/devserver.py [порт=8765]. Неизвестные пути отдают index.html (как nginx)."""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE, TESTS = os.path.join(ROOT, 'site'), os.path.join(ROOT, 'tests')


class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split('?', 1)[0].split('#', 1)[0]
        base, rel = (TESTS, path[len('/tests/'):]) if path.startswith('/tests/') else (SITE, path.lstrip('/'))
        full = os.path.normpath(os.path.join(base, *rel.split('/')))
        if not full.startswith(base):
            return os.path.join(SITE, 'index.html')
        if os.path.isdir(full) and os.path.exists(os.path.join(full, 'index.html')):
            return os.path.join(full, 'index.html')
        if not os.path.exists(full) and base == SITE and '.' not in os.path.basename(full):
            return os.path.join(SITE, 'index.html')  # /kazan/ и прочие адреса городов
        return full

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
print(f'http://localhost:{port}/')
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
