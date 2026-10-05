#!/usr/bin/env bash
# Докачивает на VPS mp3 городов, которых там ещё нет: site/cities/<id>/music/*.mp3 -> /opt/lofi-goroda/music/<id>/
# Файлы не перезаписываются и не удаляются — только добавляются новые (имя трека = его id, он не меняется).
# Запуск: bash deploy/sync_music.sh (вызывается из deploy.sh)
set -euo pipefail
cd "$(dirname "$0")/../site"
HOST=${HOST:-myvps2}
remote=$(ssh "$HOST" 'mkdir -p /opt/lofi-goroda/music && cd /opt/lofi-goroda/music && find . -name "*.mp3" | sed "s|^\./||"')
missing=()
for f in cities/*/music/*.mp3; do
  [ -e "$f" ] || continue
  rel="$(echo "$f" | cut -d/ -f2)/$(basename "$f")"   # <id>/<file>.mp3
  grep -qxF "$rel" <<<"$remote" || missing+=("$f")
done
if [ ${#missing[@]} -eq 0 ]; then echo "музыка: всё уже на сервере"; exit 0; fi
echo "музыка: докачиваю ${#missing[@]} файлов"
# cities/<id>/music/x.mp3 -> <id>/x.mp3 на сервере
tar -cf - --transform 's|^cities/\([^/]*\)/music/|\1/|' "${missing[@]}" \
  | ssh "$HOST" 'tar --no-same-owner -xf - -C /opt/lofi-goroda/music && chmod -R a+rX /opt/lofi-goroda/music'
