#!/usr/bin/env bash
# Вся очередь на одну аренду GPU. Запускается НА GPU-сервере после установки ACE-Step (README, шаги 1–3):
#   bash ~/music/gpu_queue.sh            — генерация недостающих городов + плейлисты + архивы на скачивание
#   CITIES="bam anadyr" bash ~/music/gpu_queue.sh   — только эти
# Повторный запуск безопасен: готовые wav пропускаются.
# Время: ~77 с на трек (медиана прошлых прогонов) → 10 пилотных + 210 + 144 ночных + 4×2 с голосом ≈ 372 трека ≈ 8 ч.
# Модель — та же, что у всего эфира (music/final/log.jsonl: xl-sft, 50 шагов, shift 1). Без этих флагов generate.py
# взял бы turbo по умолчанию, и новые треки звучали бы иначе, чем уже играющие.
set -euo pipefail
CITIES=${CITIES:-"samara ekaterinburg irkutsk vnovgorod bam anadyr transsib"}
cd ~/ACE-Step-1.5
M=(--model acestep-v15-xl-sft --steps 50 --shift 1.0)

args=()
for c in $CITIES; do args+=(--city "$c"); done

# 0) WAV пилотного релиза «Радио Санкт-Петербург, часть 1»: старый сервер удалён вместе с WAV.
#    Те же описания, модель и сиды (сид считается от id) → те же треки, что в эфире; ~13 мин.
PILOT="spb-01-utro-na-karpovke spb-02-tramvaj-do-novoj-gollandii spb-03-dvor-kolodec-na-rubinshtejna spb-04-chaj-na-petrogradke spb-05-linii-vasilevskogo spb-06-fonari-na-fontanke spb-07-tuman-nad-smolenkoj spb-08-kolomna-posle-dozhdya spb-09-kryshi-ligovki spb-10-skver-u-pyati-uglov"
uv run python ~/music/generate.py "${M[@]}" --variants 1 --ids $PILOT

# 1) музыка: один вариант на трек (берём всё равно v1), лог — в ~/music/out/log.jsonl
uv run python ~/music/generate.py "${M[@]}" --variants 1 "${args[@]}"

# 1б) ночной эфир (по 8 медленных треков на окно) и пилот треков с голосом (2 варианта — выбрать лучший)
ids() { python3 -c "import json,sys;print(' '.join(t['id'] for t in json.load(open('$HOME/music/prompts.json'))['tracks'] if t.get(sys.argv[1])))" "$1"; }
uv run python ~/music/generate.py "${M[@]}" --variants 1 --ids $(ids night)
uv run python ~/music/generate.py "${M[@]}" --variants 2 --ids $(ids vocal)

# 2) плейлисты с длительностями (ffprobe есть только здесь) — в ~/music/pl/<city>/
ALL="piter kazan vladimir yaroslavl vologda krasnodar sochi nnovgorod kaliningrad vladivostok murmansk $CITIES"
for c in $ALL; do
  uv run python ~/music/make_playlist.py --city "$c" --dest "$HOME/music/pl/{city}" --no-copy
done

# 3) архивы на скачивание: mp3 новых городов + плейлисты + лог; WAV — для релизов на стриминги
cd ~/music/out
tar czf ~/queue-mp3.tgz $(for c in $ALL; do ls "$c"/*-n[0-9]*.mp3 "$c"/*-v[0-9]*-*.mp3 2>/dev/null; done) $(for c in $CITIES; do ls "$c"/*.mp3 2>/dev/null; done) log.jsonl -C ~/music pl
# WAV для стримингов: пилот — как есть (под имена tracklist.csv), всё остальное — во FLAC без потерь (вдвое меньше),
# чтобы следующие релизы не зависели от сервера: его удаляют сразу после аренды
tar cf ~/release-wav-piter-1.tar $(for i in $PILOT; do echo "piter/$i-v1.wav"; done)
mkdir -p ~/flac && for w in */*.wav; do f=~/flac/${w%.wav}.flac; [ -f "$f" ] || { mkdir -p "$(dirname "$f")"; ffmpeg -loglevel error -i "$w" -c:a flac "$f"; }; done
tar cf ~/release-flac-all.tar -C ~/flac .
ls -lh ~/queue-mp3.tgz ~/release-*.tar 2>/dev/null
echo "Готово. Скачать: scp root@<IP>:~/queue-mp3.tgz . и scp root@<IP>:~/release-*.tar release/ — ДО удаления сервера"
