"""Local Ollama LLM client."""

import json
import os
import time
import urllib.error
import urllib.request

MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
NUM_CTX = 4096
THINK = False
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")


def _chat_completion(messages: list, temperature: float) -> str:
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "think": THINK,
        "options": {
            "temperature": temperature,
            "num_ctx": NUM_CTX,
        },
    }
    request = urllib.request.Request(
        OLLAMA_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.load(response)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RuntimeError(
                f"Ollama returned 404 for model '{MODEL}'. Install it with `ollama pull {MODEL}` "
                "or set OLLAMA_MODEL to an installed model."
            ) from e
        raise
    return body["message"]["content"]


def llm(prompt: str, temperature: float = 0.7, max_retries: int = 8) -> str:
    """Single-prompt call for story/timeline generation."""
    for attempt in range(max_retries):
        try:
            return _chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"Error: {e}, retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)


def llm_messages(messages: list, temperature: float = 0.7, max_retries: int = 8, quality: bool = False) -> str:
    """Multi-turn messages call for interrogation."""
    for attempt in range(max_retries):
        try:
            return _chat_completion(
                messages=messages,
                temperature=temperature,
            )
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"Error: {e}, retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
