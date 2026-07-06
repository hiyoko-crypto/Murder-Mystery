"""Local Ollama LLM client using OpenAI-compatible endpoint."""

import time
from openai import OpenAI

MODEL = "qwen2.5:7b"

client = OpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1"
)


def llm(prompt: str, temperature: float = 0.7, max_retries: int = 8) -> str:
    """Single-prompt call for story/timeline generation."""
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature
            )
            return response.choices[0].message.content
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
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"Error: {e}, retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait)
