"""
FastAPI server connecting the React frontend to the KG-based GameSession.
"""

import os
import json
import glob
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from game_session import GameSession


# ── Session state ─────────────────────────────────────────────────────────────

_sessions: dict[str, GameSession] = {}   # lang → GameSession
scenario_json: dict | None = None

SCENARIO_GLOB = "scenarios/*.json"


def _find_scenario() -> str | None:
    files = sorted(glob.glob(SCENARIO_GLOB))
    return next((f for f in files if "template" not in os.path.basename(f).lower()), None)


def _load_raw_scenario() -> dict | None:
    path = _find_scenario()
    if not path:
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _get_session(lang: str = "ja") -> GameSession:
    if lang not in _sessions:
        raise HTTPException(503, "Session not loaded")
    return _sessions[lang]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scenario_json
    scenario_json = _load_raw_scenario()
    path = _find_scenario()
    if path:
        for lang in ("en", "ja"):
            try:
                _sessions[lang] = GameSession(path, language=lang)
                print(f"[api] GameSession({lang}) loaded: {path}")
            except Exception as e:
                print(f"[api] GameSession({lang}) failed: {e}")
    else:
        print("[api] No scenario found in scenarios/")
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Holmes KG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    suspect_id: str
    message: str
    lang: str = "ja"


class ChatResponse(BaseModel):
    text: str
    emotion: str = "neutral"
    unlocked_location: str | None = None


class IndictRequest(BaseModel):
    suspect_id: str
    reason: str
    lang: str = "ja"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "sessions": list(_sessions.keys()),
        "scenario_loaded": scenario_json is not None,
    }


@app.get("/scenario")
def get_scenario():
    if scenario_json is None:
        raise HTTPException(404, "No scenario JSON found in scenarios/")
    return scenario_json


@app.get("/scenarios")
def list_scenarios():
    files = sorted(glob.glob(SCENARIO_GLOB))
    return [
        {"id": os.path.basename(f).replace(".json", ""), "path": f}
        for f in files
        if "template" not in os.path.basename(f).lower()
    ]


@app.get("/briefing")
def briefing(lang: str = "ja"):
    gs = _get_session(lang)
    return gs.get_briefing()


@app.get("/state")
def get_state(lang: str = "ja"):
    gs = _get_session(lang)
    state = gs.get_state()
    return {
        "current_suspect_id": state.current_suspect_id,
        "suspects": [{"id": s.id, "name": s.name} for s in state.suspects],
        "available_locations": [
            {"id": l.id, "name": l.name, "examined": l.examined, "is_new": l.is_new}
            for l in state.available_locations
        ],
        "found_items": [
            {"id": i.id, "name": i.name, "description": i.description}
            for i in state.found_items
        ],
        "turn": state.turn,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    gs = _get_session(req.lang)
    try:
        gs.switch_suspect(req.suspect_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

    response_text = await asyncio.to_thread(gs.ask, req.message)

    new_locs = list(gs._new_location_ids)
    return ChatResponse(
        text=response_text,
        emotion="neutral",
        unlocked_location=new_locs[0] if new_locs else None,
    )


@app.post("/examine/location/{location_id}")
async def examine_location(location_id: str, lang: str = "ja"):
    gs = _get_session(lang)
    result = await asyncio.to_thread(gs.examine_location, location_id)
    return {
        "description": result.description,
        "newly_found": [
            {"id": i.id, "name": i.name, "description": i.description}
            for i in result.newly_found
        ],
        "already_found": [
            {"id": i.id, "name": i.name, "description": i.description}
            for i in result.already_found
        ],
        "unlocked_location": result.unlocked_location,
    }


@app.get("/examine/item/{item_id}")
async def examine_item(item_id: str, lang: str = "ja"):
    gs = _get_session(lang)
    result = await asyncio.to_thread(gs.examine_item, item_id)
    return {
        "name": result.name,
        "description": result.description,
        "significance": result.significance,
        "unlocked_location": result.unlocked_location,
    }


@app.post("/indict")
async def indict(req: IndictRequest):
    gs = _get_session(req.lang)
    try:
        result = await asyncio.to_thread(gs.indict, req.suspect_id, req.reason)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {
        "correct": result.correct,
        "accused_name": result.accused_name,
        "reason_accepted": result.reason_accepted,
        "won": result.won,
        "message": result.message,
    }
