"""Configuration and constants for Supertonic TTS package.

This module centralizes all configuration values, magic numbers, and default
settings used throughout the package.
"""

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Available models
AVAILABLE_MODELS = ["supertonic", "supertonic-2", "supertonic-3"]
DEFAULT_MODEL = "supertonic-3"

# Model configuration mapping.
#
# `revision` pins the HuggingFace Hub commit each Supertonic release was
# tested against. Pinning by SHA (instead of `"main"`) keeps a `pip install`
# of a given package version reproducible even if the HF repo later
# changes. To upgrade the model, bump the SHA here and ship a new package
# release. Power users can still override with the
# `SUPERTONIC_MODEL_REVISION` environment variable.
MODEL_CONFIGS = {
    "supertonic": {
        "repo": "Supertone/supertonic",
        "cache_dir": "supertonic",
        "multilingual": False,
        "revision": "b6856d033f622c63ea29441795be266a1133e227",
    },
    "supertonic-2": {
        "repo": "Supertone/supertonic-2",
        "cache_dir": "supertonic2",
        "multilingual": True,
        "revision": "75e6727618a02f323c720cba9478152d4bc16ca4",
    },
    "supertonic-3": {
        "repo": "Supertone/supertonic-3",
        "cache_dir": "supertonic3",
        "multilingual": True,
        "revision": "724fb5abbf5502583fb520898d45929e62f02c0b",
    },
}

# Default model settings (can be overridden by environment variables)
DEFAULT_MODEL_REPO = os.getenv("SUPERTONIC_MODEL_REPO", MODEL_CONFIGS[DEFAULT_MODEL]["repo"])
# ``SUPERTONIC_CACHE_DIR`` is intentionally not snapshotted to a module-level
# constant here — it is consulted at call time inside
# :func:`get_model_cache_dir` so the override is honored on every code path
# (notably ``TTS(model="…")``, the default and most common entry) and
# late-set env vars (test fixtures, late configuration) take effect.
# Optional revision override. When unset (the common case), each model is
# downloaded at its pinned SHA from `MODEL_CONFIGS`. When set, the override
# applies to every model — primarily a debugging / development knob.
MODEL_REVISION_ENV_OVERRIDE = os.getenv("SUPERTONIC_MODEL_REVISION")


def get_model_config(model_name: str) -> dict:
    """Get configuration for a specific model.

    Args:
        model_name: Model name (one of ``AVAILABLE_MODELS``)

    Returns:
        Dictionary with model configuration (repo, cache_dir, multilingual)

    Raises:
        ValueError: If model_name is not valid
    """
    if model_name not in MODEL_CONFIGS:
        raise ValueError(
            f"Invalid model: '{model_name}'. " f"Available models: {', '.join(AVAILABLE_MODELS)}"
        )
    return MODEL_CONFIGS[model_name]


def get_model_cache_dir(model_name: str) -> Path:
    """Get cache directory for a specific model.

    ``$SUPERTONIC_CACHE_DIR`` overrides the directory for *every* model when
    set — matching the documented contract and the historical
    ``DEFAULT_CACHE_DIR`` spelling. Users running two models from the same
    process and wanting them separated should leave the env var unset (each
    model then falls back to its own ``~/.cache/<cache_dir>``).

    Args:
        model_name: Model name (one of ``AVAILABLE_MODELS``)

    Returns:
        Path to the model's cache directory
    """
    env = os.environ.get("SUPERTONIC_CACHE_DIR")
    if env:
        return Path(env).expanduser()
    config = get_model_config(model_name)
    return Path.home() / ".cache" / config["cache_dir"]


def get_model_repo(model_name: str) -> str:
    """Get HuggingFace repo ID for a specific model.

    Args:
        model_name: Model name (one of ``AVAILABLE_MODELS``)

    Returns:
        HuggingFace repository ID
    """
    config = get_model_config(model_name)
    return config["repo"]


def get_model_revision(model_name: str) -> str:
    """Get the HuggingFace Hub revision to download for a model.

    Priority: ``SUPERTONIC_MODEL_REVISION`` env var (if set) → the
    per-model pinned SHA in ``MODEL_CONFIGS``. Pinning by SHA keeps a
    given package version reproducible across HF Hub updates.

    Args:
        model_name: Model name (one of ``AVAILABLE_MODELS``)

    Returns:
        Commit SHA (or whatever ref the env override points at).
    """
    if MODEL_REVISION_ENV_OVERRIDE:
        return MODEL_REVISION_ENV_OVERRIDE
    return get_model_config(model_name)["revision"]


def is_multilingual_model(model_name: str) -> bool:
    """Check if a model supports multilingual synthesis.

    Args:
        model_name: Model name (one of ``AVAILABLE_MODELS``)

    Returns:
        True if model supports multiple languages
    """
    config = get_model_config(model_name)
    return config["multilingual"]


# Model paths
ONNX_DIR = Path("onnx")
VOICE_STYLES_DIR = Path("voice_styles")

CFG_REL_PATH = ONNX_DIR / "tts.json"
UNICODE_INDEXER_REL_PATH = ONNX_DIR / "unicode_indexer.json"
DP_ONNX_REL_PATH = ONNX_DIR / "duration_predictor.onnx"
TEXT_ENC_ONNX_REL_PATH = ONNX_DIR / "text_encoder.onnx"
VECTOR_EST_ONNX_REL_PATH = ONNX_DIR / "vector_estimator.onnx"
VOCODER_ONNX_REL_PATH = ONNX_DIR / "vocoder.onnx"

# Language configuration (multilingual support)
# supertonic-3 supports 31 languages plus the special "na" fallback for unknown.
# supertonic-2 supports a subset (en, ko, es, pt, fr) — language validation
# only enforces membership in this list; mismatches between a model and a
# language outside its training set are not blocked here.
SUPPORTED_LANGUAGES = [
    "en",  # English
    "ko",  # Korean
    "ja",  # Japanese
    "ar",  # Arabic
    "bg",  # Bulgarian
    "cs",  # Czech
    "da",  # Danish
    "de",  # German
    "el",  # Greek
    "es",  # Spanish
    "et",  # Estonian
    "fi",  # Finnish
    "fr",  # French
    "hi",  # Hindi
    "hr",  # Croatian
    "hu",  # Hungarian
    "id",  # Indonesian
    "it",  # Italian
    "lt",  # Lithuanian
    "lv",  # Latvian
    "nl",  # Dutch
    "pl",  # Polish
    "pt",  # Portuguese
    "ro",  # Romanian
    "ru",  # Russian
    "sk",  # Slovak
    "sl",  # Slovenian
    "sv",  # Swedish
    "tr",  # Turkish
    "uk",  # Ukrainian
    "vi",  # Vietnamese
]
# Special fallback code for unknown / unsupported language.
# Wraps text with the <na>...</na> token so the model can still synthesize.
UNKNOWN_LANGUAGE = "na"
AVAILABLE_LANGUAGES = SUPPORTED_LANGUAGES + [UNKNOWN_LANGUAGE]
DEFAULT_LANGUAGE = "en"

# TTS parameters - defaults
DEFAULT_TOTAL_STEPS = 8
DEFAULT_SPEED = 1.05
DEFAULT_MAX_CHUNK_LENGTH = 300
DEFAULT_MAX_CHUNK_LENGTH_KO = 120  # Korean requires shorter chunks
DEFAULT_SILENCE_DURATION = 0.3  # seconds

# TTS parameters - constraints
MIN_SPEED = 0.7
MAX_SPEED = 2.0
MIN_TOTAL_STEPS = 1
MAX_TOTAL_STEPS = 100

# ONNX Runtime configuration
# TODO: Add parsing of SUPERTONIC_ONNX_PROVIDERS environment variable
DEFAULT_ONNX_PROVIDERS = ["CPUExecutionProvider"]  # GPU support can be added by extending this list


def _parse_env_int(env_var: str, default: Optional[int] = None) -> Optional[int]:
    """Parse integer from environment variable with validation.

    Args:
        env_var: Environment variable name
        default: Default value if not set or invalid

    Returns:
        Parsed integer or default value
    """
    value = os.getenv(env_var)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning(f"Invalid value for {env_var}: '{value}'. Using default: {default}")
        return default


# Thread configuration - None means let ONNX Runtime decide automatically
DEFAULT_INTRA_OP_NUM_THREADS = _parse_env_int("SUPERTONIC_INTRA_OP_THREADS")
DEFAULT_INTER_OP_NUM_THREADS = _parse_env_int("SUPERTONIC_INTER_OP_THREADS")

# Text processing
MAX_TEXT_LENGTH = 100_000  # Maximum characters per single synthesis call

# Logging configuration
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
LOG_LEVEL = os.getenv("SUPERTONIC_LOG_LEVEL", "INFO")
