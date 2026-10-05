#!/usr/bin/env bash
# Выкладка на VPS: bash deploy/deploy.sh  (нужен ssh-хост myvps2 в ~/.ssh/config)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${HOST:-myvps2}
python tools/build_pages.py  # страницы городов /<id>/index.html из site/index.html
ssh "$HOST" 'mkdir -p /opt/lofi-goroda/site /opt/lofi-goroda/server /opt/lofi-goroda/data /root/kanban-board/lofi-goroda'
tar -C site --exclude='*.mp3' -czf - . | ssh "$HOST" 'rm -rf /opt/lofi-goroda/site.new && mkdir -p /opt/lofi-goroda/site.new && tar --no-same-owner -xzf - -C /opt/lofi-goroda/site.new && rm -rf /opt/lofi-goroda/site.old && (mv /opt/lofi-goroda/site /opt/lofi-goroda/site.old || true) && mv /opt/lofi-goroda/site.new /opt/lofi-goroda/site'
bash deploy/sync_music.sh  # mp3 — отдельно, только новые
scp -q deploy/docker-compose.yml deploy/nginx.conf "$HOST":/opt/lofi-goroda/
scp -q server/live.py "$HOST":/opt/lofi-goroda/server/
ssh "$HOST" 'cd /opt/lofi-goroda && docker compose up -d --force-recreate >/dev/null && docker compose ps --format "{{.Name}} {{.Status}}"'
