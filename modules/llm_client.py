"""Groq LLM client using OpenAI-compatible endpoint."""

import time
import threading
from openai import OpenAI, RateLimitError

GROQ_API_KEY = "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"

MODEL_FAST    = "llama-3.1-8b-instant"       # 20,000 TPM — story/timeline generation
MODEL_QUALITY = "llama-3.3-70b-versatile"    # 6,000  TPM — interactive interrogation

# 20K TPM @ ~3.5K tokens/call → ~5.7 calls/min → 11s interval (with safety margin)
# 6K  TPM @ ~2K  tokens/call → ~3   calls/min → 21s interval
_lock_fast    = threading.Lock()
_lock_quality = threading.Lock()
_last_time_fast    = 0.0
_last_time_quality = 0.0
_INTERVAL_FAST    = 11.0
_INTERVAL_QUALITY = 21.0

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)


def _throttle(model: str):
    global _last_time_fast, _last_time_quality
    if model == MODEL_FAST:
        lock, interval = _lock_fast, _INTERVAL_FAST
    else:
        lock, interval = _lock_quality, _INTERVAL_QUALITY

    with lock:
        elapsed = time.time() - (_last_time_fast if model == MODEL_FAST else _last_time_quality)
        wait = interval - elapsed
        if wait > 0:
            time.sleep(wait)
        if model == MODEL_FAST:
            _last_time_fast = time.time()
        else:
            _last_time_quality = time.time()


def _parse_retry_after(exc: RateLimitError) -> float:
    """Extract retry-after seconds from Groq rate limit error headers."""
    try:
        val = exc.response.headers.get("retry-after") or exc.response.headers.get("x-ratelimit-reset-requests")
        if val:
            return float(val) + 1.0
    except Exception:
        pass
    return None


def _call_with_retry(messages: list, temperature: float, max_retries: int, model: str) -> str:
    for attempt in range(max_retries):
        _throttle(model)
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            wait = _parse_retry_after(e) or 2 ** (attempt + 1)
            print(f"Rate limit hit, retrying in {wait:.0f}s... (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)


def llm(prompt: str, temperature: float = 0.7, max_retries: int = 8) -> str:
    """Single-prompt call — uses fast model (story/timeline generation)."""
    return _call_with_retry([{"role": "user", "content": prompt}], temperature, max_retries, MODEL_FAST)


def llm_messages(messages: list, temperature: float = 0.7, max_retries: int = 8, quality: bool = False) -> str:
    """Multi-turn messages call. quality=True uses 70b model for interrogation."""
    model = MODEL_QUALITY if quality else MODEL_FAST
    return _call_with_retry(messages, temperature, max_retries, model)
