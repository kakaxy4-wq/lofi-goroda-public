#!/usr/bin/env bash
# Выкладка на VPS: bash deploy/deploy.sh  (нужен ssh-хост myvps2 в ~/.ssh/config)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${HOST:-myvps2}
source "$(dirname "$0")/ssh_env.sh"
python tools/build_pages.py  # страницы городов /<id>/index.html из site/index.html
ssh "$HOST" 'mkdir -p /opt/lofi-goroda/site /opt/lofi-goroda/server /opt/lofi-goroda/data /opt/lofi-goroda/bot /root/kanban-board/lofi-goroda'
tar -C site --exclude='*/music/*.mp3' -czf - . | ssh "$HOST" 'rm -rf /opt/lofi-goroda/site.new && mkdir -p /opt/lofi-goroda/site.new && tar --no-same-owner -xzf - -C /opt/lofi-goroda/site.new && rm -rf /opt/lofi-goroda/site.old && (mv /opt/lofi-goroda/site /opt/lofi-goroda/site.old || true) && mv /opt/lofi-goroda/site.new /opt/lofi-goroda/site'
bash deploy/sync_music.sh  # mp3 — отдельно, только новые
scp -q deploy/docker-compose.yml deploy/nginx.conf "$HOST":/opt/lofi-goroda/
scp -q server/live.py "$HOST":/opt/lofi-goroda/server/
# бот: исходники (без __pycache__) и файл «Тихих новостей». bot.env здесь не создаём и не трогаем — он руками, один раз
tar -C bot --exclude='__pycache__' -czf - . | ssh "$HOST" 'rm -rf /opt/lofi-goroda/bot.new && mkdir -p /opt/lofi-goroda/bot.new && tar --no-same-owner -xzf - -C /opt/lofi-goroda/bot.new && rm -rf /opt/lofi-goroda/bot && mv /opt/lofi-goroda/bot.new /opt/lofi-goroda/bot'
scp -q docs/CHANGES.md "$HOST":/opt/lofi-goroda/CHANGES.md
ssh "$HOST" 'test -f /opt/lofi-goroda/bot.env && test -f /opt/lofi-goroda/live.env' || { echo "Нет /opt/lofi-goroda/bot.env или live.env на сервере: создайте по bot/env.example (compose без них не поднимется)" >&2; exit 1; }
ssh "$HOST" 'cd /opt/lofi-goroda && docker compose up -d --build --force-recreate >/dev/null && docker compose ps --format "{{.Name}} {{.Status}}"'
