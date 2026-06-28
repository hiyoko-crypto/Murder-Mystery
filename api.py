"""
FastAPI server for the murder mystery frontend.
Usage:
  uvicorn api:app --reload
"""

import os
import re
import json
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from modules.llm_client import llm_messages
from modules.assemble_suspect_context import assemble_suspect_context
from story_elements.pickle_plot import load_plot


# ── Story state ───────────────────────────────────────────────────────────────

plot = None


def _load_latest_plot():
    saves_dir = "saves"
    if not os.path.exists(saves_dir):
        print("[api] 'saves/' not found — run main.py to generate a story first")
        return None
    saves = sorted(
        [d for d in os.listdir(saves_dir) if os.path.isdir(os.path.join(saves_dir, d))],
        reverse=True,
    )
    if not saves:
        print("[api] No saves found — run main.py to generate a story first")
        return None
    path = os.path.join(saves_dir, saves[0])
    loaded = load_plot(path)
    print(f"[api] Loaded plot from: {path}")
    return loaded


@asynccontextmanager
async def lifespan(app: FastAPI):
    global plot
    plot = _load_latest_plot()
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Holmes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str                        # "player" | "suspect"
    text: str
    presentedItemId: Optional[str] = None


class ChatRequest(BaseModel):
    suspect_name: str                # 部分一致OK: "elena" → "Elena Rostova"
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    text: str
    emotion: str                     # neutral | nervous | angry | sad | surprised | happy


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_TEMPLATE = """\
You are a suspect being interrogated by a detective about a murder case.
Stay fully in character. Respond in Japanese. Be evasive, defensive, or emotional as fits your personality.

--- YOUR CHARACTER CONTEXT ---
{context}
--- END CONTEXT ---

IMPORTANT: Reply with ONLY this JSON — no extra text, no markdown:
{{"text": "your spoken reply in Japanese", "emotion": "neutral|nervous|angry|sad|surprised|happy"}}
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_suspect_index(name: str) -> int:
    for i, s in enumerate(plot.suspects):
        if name.lower() in s.name.lower():
            return i
    return -1


def _parse_llm_output(raw: str) -> dict:
    match = re.search(r'\{.*?\}', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"text": raw.strip(), "emotion": "neutral"}


VALID_EMOTIONS = {"neutral", "nervous", "angry", "sad", "surprised", "happy"}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "plot_loaded": plot is not None}


@app.get("/suspects")
def get_suspects():
    if plot is None:
        raise HTTPException(503, "No story loaded")
    return [
        {"index": i, "name": s.name, "bio": s.bio}
        for i, s in enumerate(plot.suspects)
    ]


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if plot is None:
        raise HTTPException(503, "No story loaded — run main.py first to generate a save")

    idx = _find_suspect_index(req.suspect_name)
    if idx == -1:
        raise HTTPException(404, f"Suspect '{req.suspect_name}' not found")

    context = assemble_suspect_context(plot, idx)
    system_prompt = SYSTEM_TEMPLATE.format(context=context)

    # OpenAI-format messages
    openai_msgs: list = [{"role": "system", "content": system_prompt}]
    for msg in req.messages:
        if msg.role == "player":
            if msg.presentedItemId:
                content = f"[Detective presents evidence: {msg.text}]"
            else:
                content = msg.text
            openai_msgs.append({"role": "user", "content": content})
        elif msg.role == "suspect":
            openai_msgs.append({"role": "assistant", "content": msg.text})

    raw = llm_messages(openai_msgs)
    data = _parse_llm_output(raw)

    emotion = data.get("emotion", "neutral")
    if emotion not in VALID_EMOTIONS:
        emotion = "neutral"

    return ChatResponse(text=data.get("text", raw), emotion=emotion)
