#!/usr/bin/env python3
"""Пакетная генерация лоуфай-треков «Лофи-города» через ACE-Step 1.5.

Запускается НА GPU-СЕРВЕРЕ из окружения ACE-Step 1.5 (см. README.md):

    cd ~/ACE-Step-1.5
    uv run python ~/music/generate.py --prompts ~/music/prompts.json --out ~/music/out --variants 2

Что делает:
  1. Читает prompts.json, для каждого трека и варианта считает детерминированный сид.
  2. Пропускает варианты, для которых out/<city>/<id>-v<N>.wav уже есть.
  3. Генерирует недостающие через официальный Python API ACE-Step 1.5
     (acestep.inference.generate_music; см. docs/en/INFERENCE.md в их репозитории).
  4. Пишет строку в out/log.jsonl на каждый вариант (успех/ошибка, сид, время).
  5. Если есть ffmpeg: двухпроходная нормализация громкости loudnorm (I=-16 LUFS),
     фейды 2 с в начале и в конце, mp3 128k -> out/<city>/<id>-v<N>.mp3.

Режимы:
  --dry-run    только показать план (без ACE-Step, можно на любой машине);
  --post-only  только постобработка готовых wav (без ACE-Step, нужен ffmpeg).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------- utils

def log_event(log_path: Path, **rec) -> None:
    rec.setdefault("ts", time.strftime("%Y-%m-%dT%H:%M:%S"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def load_tracks(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    tracks = data["tracks"] if isinstance(data, dict) else data
    ids = [t["id"] for t in tracks]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        sys.exit(f"В {path} повторяются id: {sorted(dup)}")
    return tracks


def seed_for(track_id: str, variant: int, base: int) -> int:
    """Стабильный сид: один и тот же id+вариант всегда даёт один и тот же сид."""
    h = int(hashlib.sha1(track_id.encode("utf-8")).hexdigest()[:8], 16)
    return (base + h + variant * 1009) % 2_000_000_000


def wav_path(out: Path, t: dict, v: int) -> Path:
    return out / t["city"] / f"{t['id']}-v{v}.wav"


# ---------------------------------------------------------------- ffmpeg

def have_ffmpeg() -> bool:
    return bool(shutil.which("ffmpeg")) and bool(shutil.which("ffprobe"))


def probe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def loudnorm_measure(src: Path, target_i: float, tp: float, lra: float) -> dict | None:
    """Первый проход loudnorm: измеряем, чтобы второй проход был линейным и точным."""
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af",
         f"loudnorm=I={target_i}:TP={tp}:LRA={lra}:print_format=json",
         "-f", "null", "-"],
        capture_output=True, text=True)
    err = r.stderr
    start, end = err.rfind("{"), err.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(err[start:end + 1])
    except json.JSONDecodeError:
        return None


def postprocess(src: Path, dst: Path, *, bitrate: str, fade: float,
                target_i: float = -16.0, tp: float = -1.5, lra: float = 11.0,
                sample_rate: int = 44100) -> None:
    """loudnorm (I=-16) -> фейды -> mp3. Фейды после нормализации, чтобы не влиять на замер."""
    dur = probe_duration(src)
    m = loudnorm_measure(src, target_i, tp, lra)
    ln = f"loudnorm=I={target_i}:TP={tp}:LRA={lra}"
    if m:
        ln += (f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
               f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
               f":offset={m['target_offset']}:linear=true")
    fade_out_start = max(0.0, dur - fade)
    af = f"{ln},afade=t=in:st=0:d={fade},afade=t=out:st={fade_out_start:.3f}:d={fade}"
    tmp = dst.with_suffix(".tmp.mp3")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", af, "-ar", str(sample_rate), "-ac", "2",
         "-codec:a", "libmp3lame", "-b:a", bitrate, str(tmp)],
        check=True)
    tmp.replace(dst)


# ---------------------------------------------------------------- ACE-Step

class AceStep:
    """Тонкая обёртка над официальным Python API ACE-Step 1.5 (docs/en/INFERENCE.md)."""

    def __init__(self, args):
        root = Path(args.acestep_root).expanduser().resolve()
        if not (root / "acestep").is_dir():
            sys.exit(f"Не найден пакет acestep в {root}. Укажите --acestep-root или ACESTEP_ROOT.")
        sys.path.insert(0, str(root))
        from acestep.handler import AceStepHandler           # noqa: E402
        from acestep.llm_inference import LLMHandler          # noqa: E402
        from acestep.inference import (GenerationParams,      # noqa: E402
                                       GenerationConfig, generate_music)
        self.GenerationParams = GenerationParams
        self.GenerationConfig = GenerationConfig
        self.generate_music = generate_music
        self.args = args

        # Недокументированный, но используемый их cli.py путь: докачать модели заранее.
        # Если что-то пойдёт не так — просто полагаемся на автозагрузку при первом запуске.
        ck = root / "checkpoints"
        try:
            from acestep.model_downloader import (ensure_main_model, ensure_dit_model,
                                                  ensure_lm_model, get_checkpoints_dir,
                                                  check_model_exists)
            ck = Path(get_checkpoints_dir())
            ensure_main_model(ck)
            if not check_model_exists(args.model, ck):
                ensure_dit_model(args.model, ck)
            if args.thinking and not check_model_exists(args.lm_model, ck):
                ensure_lm_model(args.lm_model, checkpoints_dir=ck)
        except Exception as e:  # noqa: BLE001
            print(f"[warn] предзагрузка моделей не удалась ({e}); надеемся на автозагрузку")

        self.dit = AceStepHandler()
        init_kwargs = dict(project_root=str(root), config_path=args.model, device=args.device)
        if args.offload:
            init_kwargs.update(offload_to_cpu=True)
        self.dit.initialize_service(**init_kwargs)

        self.llm = LLMHandler()
        if args.thinking:
            self.llm.initialize(
                checkpoint_dir=str(Path(args.checkpoint_dir).expanduser()) if args.checkpoint_dir
                else str(ck),
                lm_model_path=args.lm_model,
                backend=args.backend,
                device=args.device,
            )

    def generate(self, t: dict, seeds: list[int], save_dir: Path) -> list[dict]:
        a = self.args
        params = self.GenerationParams(
            task_type="text2music",
            caption=t["tags"],
            lyrics="[Instrumental]",
            instrumental=True,
            bpm=int(t["bpm"]),
            keyscale=t["key"],
            timesignature="4",
            duration=float(t["duration"]),
            inference_steps=a.steps,
            shift=a.shift,
            seed=seeds[0],
            thinking=a.thinking,
            # Отрицательная подсказка в ACE-Step 1.5 есть только для LM (lm_negative_prompt);
            # у DiT явного negative prompt нет. Без --thinking она ни на что не влияет.
            lm_negative_prompt=t.get("negative") or "NO USER INPUT",
            # Не даём LM переписывать наш caption/метаданные — стиль партии должен быть единым.
            use_cot_caption=False,
            use_cot_metas=False,
            use_cot_lyrics=False,
        )
        config = self.GenerationConfig(
            batch_size=len(seeds),
            use_random_seed=False,
            seeds=list(seeds),
            audio_format="wav",
        )
        res = self.generate_music(self.dit, self.llm, params, config, save_dir=str(save_dir))
        if not res.success:
            raise RuntimeError(res.error or "generate_music вернул success=False")
        return list(res.audios)


# ---------------------------------------------------------------- main

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--prompts", default=str(HERE / "prompts.json"))
    p.add_argument("--out", default=str(HERE / "out"))
    p.add_argument("--variants", type=int, default=2, help="сколько сидов на трек (v1..vN)")
    p.add_argument("--city", action="append", help="только эти города (spb, kazan); можно повторять")
    p.add_argument("--ids", nargs="*", help="только эти id треков")
    p.add_argument("--limit", type=int, default=0, help="не больше N треков (для пробы)")
    p.add_argument("--seed-base", type=int, default=20260927)
    p.add_argument("--acestep-root", default=os.environ.get("ACESTEP_ROOT", "~/ACE-Step-1.5"))
    p.add_argument("--model", default="acestep-v15-turbo", help="DiT: acestep-v15-turbo / acestep-v15-sft / ...")
    p.add_argument("--steps", type=int, default=8, help="8 для turbo, 32-64 для base/sft")
    p.add_argument("--shift", type=float, default=3.0, help="3.0 рекомендовано для turbo")
    p.add_argument("--device", default="cuda")
    p.add_argument("--offload", action="store_true", help="offload_to_cpu=True (мало VRAM)")
    p.add_argument("--thinking", action="store_true", help="включить 5Hz LM (нужно для negative)")
    p.add_argument("--lm-model", default="acestep-5Hz-lm-1.7B")
    p.add_argument("--checkpoint-dir", default=None)
    p.add_argument("--backend", default="vllm", choices=["vllm", "pt"])
    p.add_argument("--bitrate", default="128k")
    p.add_argument("--fade", type=float, default=2.0)
    p.add_argument("--no-post", action="store_true", help="не делать mp3/loudnorm/фейды")
    p.add_argument("--post-only", action="store_true", help="только постобработка готовых wav")
    p.add_argument("--force-post", action="store_true", help="переделать mp3 даже если есть")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    out = Path(args.out).expanduser().resolve()
    log_path = out / "log.jsonl"
    tracks = load_tracks(Path(args.prompts))
    if args.city:
        tracks = [t for t in tracks if t["city"] in set(args.city)]
    if args.ids:
        tracks = [t for t in tracks if t["id"] in set(args.ids)]
    if args.limit:
        tracks = tracks[:args.limit]
    variants = range(1, args.variants + 1)

    todo = [(t, v) for t in tracks for v in variants if not wav_path(out, t, v).exists()]
    print(f"Треков: {len(tracks)}, вариантов: {args.variants}, "
          f"к генерации: {len(todo)}, уже готово: {len(tracks) * args.variants - len(todo)}")

    if args.dry_run:
        for t, v in todo:
            print(f"  {wav_path(out, t, v).relative_to(out)}  seed={seed_for(t['id'], v, args.seed_base)}"
                  f"  bpm={t['bpm']} key={t['key']} dur={t['duration']}")
        return

    # ---- генерация
    if todo and not args.post_only:
        ace = AceStep(args)
        by_track: dict[str, list[int]] = {}
        for t, v in todo:
            by_track.setdefault(t["id"], []).append(v)
        tmap = {t["id"]: t for t in tracks}
        for n, (tid, vs) in enumerate(by_track.items(), 1):
            t = tmap[tid]
            seeds = [seed_for(tid, v, args.seed_base) for v in vs]
            print(f"[{n}/{len(by_track)}] {tid} v{vs} seeds={seeds}", flush=True)
            t0 = time.time()
            out.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix=".gen-", dir=out) as tmp:
                try:
                    audios = ace.generate(t, seeds, Path(tmp))
                    if len(audios) < len(vs):
                        raise RuntimeError(f"получено {len(audios)} аудио из {len(vs)}")
                    for v, seed, audio in zip(vs, seeds, audios):
                        src = Path(audio.get("path") or "")
                        if not src.is_file():
                            raise RuntimeError(f"generate_music не сохранил файл (path={src!s})")
                        dst = wav_path(out, t, v)
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(src), dst)
                        used_seed = (audio.get("params") or {}).get("seed", seed)
                        log_event(log_path, id=tid, city=t["city"], variant=v, seed=used_seed,
                                  requested_seed=seed, status="ok", file=str(dst.relative_to(out)),
                                  model=args.model, steps=args.steps, shift=args.shift,
                                  thinking=args.thinking, bpm=t["bpm"], key=t["key"],
                                  duration=t["duration"], tags=t["tags"],
                                  elapsed_s=round(time.time() - t0, 1))
                except Exception as e:  # noqa: BLE001
                    print(f"   ОШИБКА: {e}", flush=True)
                    for v, seed in zip(vs, seeds):
                        log_event(log_path, id=tid, city=t["city"], variant=v, seed=seed,
                                  status="error", error=str(e), elapsed_s=round(time.time() - t0, 1))

    # ---- постобработка
    if args.no_post:
        return
    if not have_ffmpeg():
        print("[warn] ffmpeg/ffprobe не найдены — mp3, нормализация и фейды пропущены. "
              "Поставьте ffmpeg и запустите с --post-only.")
        return
    for t in tracks:
        for v in variants:
            src = wav_path(out, t, v)
            dst = src.with_suffix(".mp3")
            if not src.exists() or (dst.exists() and not args.force_post):
                continue
            try:
                postprocess(src, dst, bitrate=args.bitrate, fade=args.fade)
                print(f"mp3: {dst.relative_to(out)}")
                log_event(log_path, id=t["id"], variant=v, status="post_ok",
                          file=str(dst.relative_to(out)), dur=round(probe_duration(dst), 1))
            except subprocess.CalledProcessError as e:
                print(f"   ffmpeg ошибка на {src.name}: {e}")
                log_event(log_path, id=t["id"], variant=v, status="post_error", error=str(e))


if __name__ == "__main__":
    main()
