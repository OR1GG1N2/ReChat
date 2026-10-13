"""ReChat standalone neural TTS worker (Supertonic ONNX engine)."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import numpy as np
import os
from pathlib import Path
import re
import sys
import traceback

# Ensure UTF-8 streams on Windows
if sys.platform == 'win32':
    try:
        sys.stdin.reconfigure(encoding='utf-8')
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import soundfile as sf
import supertonic

# ---------------------------------------------------------------------------
# Text Preprocessing & Cleaning for Natural Speech
# ---------------------------------------------------------------------------
SPEECH_URL_PATTERN = re.compile(
    r"(?ix)"
    r"(?:https?://|www\.)[^\s<>()\[\]{}\"']+"
    r"|"
    r"(?<![@\w])"
    r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"(?:[a-z]{2,63}|xn--[a-z0-9-]{2,})"
    r"(?::\d{1,5})?"
    r"(?:[/?#][^\s<>()\[\]{}\"']*)?"
)
SPEECH_EMAIL_PATTERN = re.compile(
    r"(?i)\b[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,63}\b"
)
SPEECH_MARKDOWN_LINK_PATTERN = re.compile(
    r"(?is)\[([^\]\n]{1,200})\]\(\s*"
    r"(?:https?://|www\.|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"(?:[a-z]{2,63}|xn--[a-z0-9-]{2,}))"
    r"[^\s)]*"
    r"(?:\s+\"[^\"]*\")?"
    r"\s*\)"
)

def _num_to_ru(n: int) -> str:
    units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
    teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
    tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
    hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
    if n == 0:
        return 'ноль'
    res = []
    if n >= 100:
        res.append(hundreds[n // 100])
        n %= 100
    if 10 <= n <= 19:
        res.append(teens[n - 10])
    else:
        if n >= 20:
            res.append(tens[n // 10])
            n %= 10
        if n > 0:
            res.append(units[n])
    return ' '.join(res)

def clean_text_for_speech(text: str) -> str:
    """Preprocesses input text, removes noise, and handles phonetic edge cases."""
    if not text:
        return ""
    cleaned = str(text)
    # 1. Markdown link syntax: [Text](URL) -> Text
    cleaned = SPEECH_MARKDOWN_LINK_PATTERN.sub(lambda m: f" {m.group(1)} ", cleaned)
    # 2. Strip URLs and emails
    cleaned = SPEECH_URL_PATTERN.sub(" ", cleaned)
    cleaned = SPEECH_EMAIL_PATTERN.sub(" ", cleaned)
    # 3. Strip tags and empty brackets
    cleaned = re.sub(r"\{.*?\}|<.*?>", " ", cleaned)
    cleaned = re.sub(r"\[\s*\]|\(\s*\)|\"\s*\"|'\s*'", " ", cleaned)
    # 4. Replace 'ё' with 'е' to prevent Unicode NFKD diacritic splitting
    cleaned = cleaned.replace('ё', 'е').replace('Ё', 'Е')
    # 5. Collapse repeating chat letters (e.g. 'привееет' -> 'привет')
    cleaned = re.sub(r'([а-яА-Яa-zA-Z])\1{2,}', r'\1', cleaned)
    # 6. Expand numbers (0..999) to Russian words
    cleaned = re.sub(r'\b\d{1,3}\b', lambda m: _num_to_ru(int(m.group(0))), cleaned)
    # 7. Strip chat smileys and multiple punctuation
    cleaned = re.sub(r'[:;]-?[\)\(\]\[\/\\DdPpoO]+', ' ', cleaned)
    cleaned = re.sub(r'[\)\(]{2,}', ' ', cleaned)
    cleaned = re.sub(r'[!]{2,}', '!', cleaned)
    cleaned = re.sub(r'[?]{2,}', '?', cleaned)
    cleaned = re.sub(r'[.]{3,}', '.', cleaned)
    # 8. Punctuation spacing and whitespace
    cleaned = re.sub(r"\s+([.,!?\u2026])", r"\1", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()

# ---------------------------------------------------------------------------
# Path Resolution
# ---------------------------------------------------------------------------
def resolve_model_dir(custom_path=None) -> str:
    if custom_path and str(custom_path).strip():
        return str(Path(custom_path).expanduser().resolve())
    app_data = os.environ.get('APPDATA', '')
    if app_data:
        return str(Path(app_data) / "ReChat" / "models" / "supertonic")
    return str(Path.home() / ".rechat" / "models" / "supertonic")

def _send_response(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()

# ---------------------------------------------------------------------------
# Supertonic Engine Instance
# ---------------------------------------------------------------------------
class SupertonicEngine:
    def __init__(self, model_dir: str):
        self.model_dir = model_dir
        # Point the library's cache to our app data folder via env var
        os.environ["SUPERTONIC_CACHE_DIR"] = model_dir
        # Use supertonic-3: multilingual model that natively supports Russian (lang="ru")
        self.model = supertonic.TTS(model='supertonic-3', auto_download=False)

    def generate(
        self,
        text: str,
        voice_name: str = "M1",
        speed: float = 1.0,
        steps: int = 32,
        max_chunk_length: int | None = None,
        silence_duration: float = 0.3,
        lang: str = "ru",
        seed: int | None = None,
    ) -> tuple[str, float]:
        cleaned = clean_text_for_speech(text)
        if not cleaned:
            raise ValueError("Текст пуст после очистки")

        # Fix random seed for deterministic output.
        # If seed is not provided, derive it from text+voice hash so the same
        # phrase always produces the same waveform (removes intonation jitter).
        if seed is None:
            seed = int(hashlib.md5((cleaned + voice_name).encode('utf-8')).hexdigest(), 16) % (2 ** 31)
        np.random.seed(seed)

        if voice_name not in self.model.voice_style_names:
            voice_name = "M1"
        style = self.model.get_voice_style(voice_name=voice_name)

        wav, dur = self.model.synthesize(
            cleaned,
            voice_style=style,
            total_steps=steps,
            speed=speed,
            max_chunk_length=max_chunk_length,
            silence_duration=silence_duration,
            lang=lang,
        )

        if hasattr(wav, "squeeze"):
            wav = wav.squeeze()

        buf = io.BytesIO()
        sf.write(buf, wav, self.model.sample_rate, format='WAV')
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

        duration_sec = float(dur[0]) if hasattr(dur, '__len__') and len(dur) > 0 else float(dur)
        data_uri = f"data:audio/wav;base64,{b64}"
        return data_uri, duration_sec

# ---------------------------------------------------------------------------
# Main RPC Loop
# ---------------------------------------------------------------------------
def run(model_dir: str) -> int:
    resolved_dir = resolve_model_dir(model_dir)

    try:
        engine = SupertonicEngine(resolved_dir)
    except Exception as e:
        _send_response({"status": "error", "ok": False, "error": str(e), "model_dir": resolved_dir})
        return 1

    # Emit ready response to Go caller
    _send_response({
        "status": "ready",
        "ok": True,
        "voices": engine.model.voice_style_names,
        "sample_rate": engine.model.sample_rate,
        "model_dir": resolved_dir,
    })

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            action = req.get("action")
            if action in ("stop", "shutdown", "exit"):
                _send_response({"ok": True, "status": "shutdown"})
                return 0

            raw_text = req.get("text") or req.get("message") or ""
            voice = req.get("voice") or req.get("voice_name") or "M1"
            speed = float(req.get("speed", 1.0))
            steps = int(req.get("steps") or req.get("total_steps") or 32)
            lang = req.get("lang") or req.get("language") or "ru"
            silence = float(req.get("silence_duration", 0.3))
            max_chunk = req.get("max_chunk_length")
            if max_chunk is not None:
                max_chunk = int(max_chunk)
            seed = req.get("seed")
            if seed is not None:
                seed = int(seed)

            data_uri, duration = engine.generate(
                text=raw_text,
                voice_name=voice,
                speed=speed,
                steps=steps,
                max_chunk_length=max_chunk,
                silence_duration=silence,
                lang=lang,
                seed=seed,
            )

            response = {
                "ok": True,
                "status": "ok",
                "dataUri": data_uri,
                "duration": duration,
            }
        except Exception as exc:
            sys.stderr.write(f"[Supertonic Worker Error] {traceback.format_exc()}\n")
            sys.stderr.flush()
            response = {"ok": False, "status": "error", "error": str(exc)}

        _send_response(response)

    return 0

def main():
    parser = argparse.ArgumentParser(description="ReChat Supertonic Worker")
    parser.add_argument("model_dir", nargs="?", default="", help="Path to model weights")
    parser.add_argument("--check", action="store_true", help="Print health check JSON and exit")
    parser.add_argument("--test", type=str, default="", help="Synthesize text to WAV file")
    parser.add_argument("--voice", type=str, default="M1", help="Voice style preset")
    parser.add_argument("--steps", type=int, default=32, help="Flow matching steps")
    parser.add_argument("--speed", type=float, default=1.0, help="Playback speed")
    parser.add_argument("--out", type=str, default="test.wav", help="Output WAV path")
    args = parser.parse_args()

    model_dir = resolve_model_dir(args.model_dir)

    if args.check:
        try:
            eng = SupertonicEngine(model_dir)
            print(json.dumps({
                "status": "ready",
                "ok": True,
                "model_dir": model_dir,
                "voices": eng.model.voice_style_names,
                "sample_rate": eng.model.sample_rate,
            }, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"status": "error", "ok": False, "error": str(e)}, ensure_ascii=False))
        return

    if args.test:
        eng = SupertonicEngine(model_dir)
        clean = clean_text_for_speech(args.test)
        style = eng.model.get_voice_style(args.voice if args.voice in eng.model.voice_style_names else "M1")
        wav, dur = eng.model.synthesize(clean, voice_style=style, total_steps=args.steps, speed=args.speed, lang="ru")
        sf.write(args.out, wav.squeeze(), eng.model.sample_rate)
        print(f"[OK] Saved {args.out} ({dur[0]:.2f}s, steps={args.steps})")
        return

    sys.exit(run(model_dir))

if __name__ == "__main__":
    main()
