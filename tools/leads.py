"""Находки «куда ответить» для продвижения Лофи-городов → карточки в беклоге (проект «Лофи: куда ответить»).

Ищет не скрипт, а ежедневная задача Claude (docs/LEADS-TASK.md); скрипт только складывает находки
и не даёт одной ссылке прийти дважды. Отвечает владелец сам, руками.

    python tools/leads.py add --where "Пикабу" --url URL --title "Суть вопроса" --draft "Черновик ответа"
    python tools/leads.py seen          # сколько ссылок уже было

Адрес беклога (он же ключ доступа) — в ~/.config/lofi/kanban_url.txt, вне репозитория.
Уже виденные ссылки — promo/leads-seen.json (promo/ не в git)."""
import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEEN = ROOT / "promo" / "leads-seen.json"
CONF = Path.home() / ".config" / "lofi" / "kanban_url.txt"
PROJECT = "Лофи: куда ответить"


def norm(url):
    url = url.strip().split("#")[0]
    url = re.sub(r"[?&](utm_[^=&]+|from|ref|share_to)=[^&]*", "", url)
    return url.rstrip("/?&").lower()


def load_seen():
    try:
        return json.loads(SEEN.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add")
    a.add_argument("--where", required=True)
    a.add_argument("--url", required=True)
    a.add_argument("--title", required=True)
    a.add_argument("--draft", required=True)
    sub.add_parser("seen")
    args = p.parse_args()

    seen = load_seen()
    if args.cmd == "seen":
        print(f"ссылок уже было: {len(seen)}")
        return
    key = norm(args.url)
    if key in seen:
        print(f"уже было {seen[key]}: {args.url}")
        return
    base = CONF.read_text(encoding="utf-8").strip().rstrip("/")
    title = f"🔎 {args.where}: {args.title.strip()[:140]} — {args.url.strip()}  ✍ {args.draft.strip()[:600]}"
    req = urllib.request.Request(base + "/add", data=json.dumps({"project": PROJECT, "title": title}, ensure_ascii=False).encode("utf-8"),
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    r = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
    if not r.get("ok"):
        sys.exit(f"беклог не принял карточку: {r}")
    seen[key] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    SEEN.parent.mkdir(parents=True, exist_ok=True)
    SEEN.write_text(json.dumps(seen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"добавлено: {args.where} — {args.url}")


if __name__ == "__main__":
    main()
