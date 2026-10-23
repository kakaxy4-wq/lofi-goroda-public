#!/usr/bin/env bash
# Замер на арендованном GPU перед большой очередью: железо, скорость ACE-Step на модели эфира, прогноз.
# Полезная работа, а не холостой тест: генерирует WAV пилотного релиза (10 треков) + 1 ночной + 1 с голосом.
# Запуск НА сервере после установки ACE-Step (README, шаг 3):  bash ~/music/gpu_bench.sh
set -euo pipefail
cd ~/ACE-Step-1.5
M=(--model acestep-v15-xl-sft --steps 50 --shift 1.0)
LOG=~/music/out/log.jsonl

echo "== железо"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
echo "CPU: $(nproc) ядер · RAM: $(free -g | awk '/Mem/{print $2}') ГБ · диск: $(df -h ~ | awk 'NR==2{print $4}') свободно"

PILOT="spb-01-utro-na-karpovke spb-02-tramvaj-do-novoj-gollandii spb-03-dvor-kolodec-na-rubinshtejna spb-04-chaj-na-petrogradke spb-05-linii-vasilevskogo spb-06-fonari-na-fontanke spb-07-tuman-nad-smolenkoj spb-08-kolomna-posle-dozhdya spb-09-kryshi-ligovki spb-10-skver-u-pyati-uglov"
first() { python3 -c "import json,sys;print(next(t['id'] for t in json.load(open('$HOME/music/prompts.json'))['tracks'] if t.get(sys.argv[1])))" "$1"; }

echo "== музыка: пилот (10), ночной (1), с голосом (1)"
uv run python ~/music/generate.py "${M[@]}" --variants 1 --ids $PILOT "$(first night)" "$(first vocal)"

echo "== итог"
python3 - "$LOG" <<'EOF'
import json, statistics, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
ok = [r for r in rows if r.get("status") == "ok" and r.get("elapsed_s")]
if not ok:
    sys.exit("нет успешных генераций — смотрите log.jsonl")
# первый трек включает загрузку модели — в медиану не берём
el = [r["elapsed_s"] for r in ok[1:]] or [ok[0]["elapsed_s"]]
dur = [r["duration"] for r in ok if r.get("duration")]
med = statistics.median(el)
print(f"треков: {len(ok)}, медиана {med:.0f} с на трек (первый, с загрузкой модели: {ok[0]['elapsed_s']:.0f} с)")
print(f"скорость: {statistics.mean(dur) / med:.1f}× реального времени")
data = json.load(open(__import__('os').path.expanduser('~/music/prompts.json')))['tracks']
import os
done = lambda t: os.path.exists(os.path.expanduser(f"~/music/out/{t['city']}/{t['id']}-v1.wav"))
new_cities = "samara ekaterinburg irkutsk vnovgorod bam anadyr transsib".split()
n_city = sum(1 for t in data if t['city'] in new_cities and not t.get('night') and not t.get('vocal') and not done(t))
n_night = sum(1 for t in data if t.get('night') and not done(t))
n_vocal = sum(1 for t in data if t.get('vocal')) * 2
total = n_city + n_night + n_vocal
print(f"осталось: города {n_city} + ночные {n_night} + с голосом {n_vocal} (2 варианта) = {total}")
print(f"прогноз музыки: {total * med / 3600:.1f} ч чистой генерации")
EOF
tar cf ~/release-wav-piter-1.tar -C ~/music/out $(for i in $PILOT; do echo "piter/$i-v1.wav"; done)
ls -lh ~/release-wav-piter-1.tar
