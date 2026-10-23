"""og-превью городов: вечерний стоп-кадр сцены 1200×630 — тот же кроп, что у открытки (shareImage).

Рендерит живую сцену движка в headless Chrome на стоп-кадре (?freeze&t=…&d=…&wx=clear),
снимает пиксели видимой канвы #scene (480×252) и увеличивает ×2.5 без размытия —
как рисует открытку в app.js. Перезаписывает site/img/og-<город>.png.

Запуск: py -3 tools/make_og.py [город ...] [--t=20:30] [--d=ГГГГ-ММ-ДД]
Нужны: websockets, Pillow (pip install websockets pillow); Chrome в стандартном месте.
"""
import argparse
import base64
import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

SP = Path(__file__).parent
SITE = SP.parent / "site"
PORT = 8767
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
# города из карточки «вечерние og-превью»; остальные 13 — та же команда, по решению владельца
DEFAULT_CITIES = ["vologda", "samara", "anadyr", "bam"]
CAPTURE = """(function(){
  const src = document.getElementById('scene');
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, 480, 252, 0, 0, 1200, 630); // тот же кроп, что в shareImage()
  return c.toDataURL('image/png');
})()"""


def start_devserver():
    proc = subprocess.Popen([sys.executable, str(SP / "devserver.py"), str(PORT)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/cities/index.json", timeout=2).read()
            return proc
        except Exception:
            time.sleep(0.25)
    proc.kill()
    raise SystemExit("devserver не поднялся")


async def capture(city, args):
    import websockets

    class Tab:
        def __init__(self, ws):
            self.ws, self.n = ws, 0
        async def cmd(self, method, params=None):
            self.n += 1
            await self.ws.send(json.dumps({"id": self.n, "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await self.ws.recv())
                if msg.get("id") == self.n:
                    if "error" in msg:
                        raise RuntimeError(f"{method}: {msg['error']}")
                    return msg.get("result", {})

    prof = os.path.join(os.environ["TEMP"], "lg-og-prof")
    proc = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={PORT + 1}",
                             f"--user-data-dir={prof}", "--no-first-run", "--hide-scrollbars",
                             "--disable-gpu", "--window-size=960,540", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(40):
            try:
                targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT + 1}/json/list", timeout=2))
                pages = [t for t in targets if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.5)
        if not ws_url:
            raise RuntimeError("Chrome не открыл devtools-порт")
        async with websockets.connect(ws_url, max_size=64 * 1024 * 1024) as ws:
            tab = Tab(ws)
            await tab.cmd("Page.enable")
            q = f"?freeze&t={args.t}&wx=clear" + (f"&d={args.d}" if args.d else "")
            await tab.cmd("Page.navigate", {"url": f"http://127.0.0.1:{PORT}/{city}/{q}"})
            await asyncio.sleep(3.5)  # сцена успевает отрисоваться; корги ещё не пришёл (первый визит через ~15 с)
            r = await tab.cmd("Runtime.evaluate", {"expression": CAPTURE, "returnByValue": True})
            if r.get("exceptionDetails"):
                raise RuntimeError(json.dumps(r["exceptionDetails"], ensure_ascii=False)[:600])
            data = r["result"]["value"].split(",", 1)[1]
            out = SITE / "img" / f"og-{city}.png"
            out.write_bytes(base64.b64decode(data))
            print("ok", city, "->", out.relative_to(SITE.parent), out.stat().st_size // 1024, "КБ")
    finally:
        proc.kill()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cities", nargs="*", default=DEFAULT_CITIES)
    ap.add_argument("--t", default="20:30", help="время стоп-кадра ЧЧ:ММ (вечер)")
    ap.add_argument("--d", default=None, help="дата ГГГГ-ММ-ДД (по умолчанию — сегодня)")
    args = ap.parse_args()
    dev = start_devserver()
    try:
        for city in args.cities:
            asyncio.run(capture(city, args))
    finally:
        dev.kill()


if __name__ == "__main__":
    main()
