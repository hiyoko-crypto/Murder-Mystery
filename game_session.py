"""
GameSession — single source of truth for one game instance.

The API / HTTP layer calls these methods only.
No CLI, no HTTP concerns here — pure game logic.
"""

from dataclasses import dataclass, field
from typing import Generator

from modules.i18n import set_lang
from modules.indictment_evaluator import evaluate_indictment
from modules.scenario_loader import ScenarioLoader
from modules.location_tracker import LocationTracker
from suspect_agents.commitment_ledger import CommitmentLedger
from suspect_agents.suspect_agent_kg import SuspectAgentKG


# ── Data shapes returned to the caller ───────────────────────────────

@dataclass
class SuspectInfo:
    id:   str
    name: str


@dataclass
class LocationInfo:
    id:       str
    name:     str
    examined: bool
    is_new:   bool          # True on first unlock


@dataclass
class ItemInfo:
    id:          str
    name:        str
    description: str


@dataclass
class ExamineResult:
    description:        str
    newly_found:        list[ItemInfo]
    already_found:      list[ItemInfo]
    unlocked_location:  str | None      # location id, or None


@dataclass
class ItemDetail:
    name:               str
    description:        str
    significance:       str
    unlocked_location:  str | None


@dataclass
class IndictResult:
    correct:          bool
    accused_name:     str
    reason_accepted:  bool
    won:              bool
    message:          str
    evaluation:       dict


@dataclass
class GameState:
    current_suspect_id:   str | None
    suspects:             list[SuspectInfo]
    available_locations:  list[LocationInfo]
    found_items:          list[ItemInfo]
    turn:                 int


# ── GameSession ───────────────────────────────────────────────────────

class GameSession:
    def __init__(self, scenario_path: str, language: str = "en"):
        set_lang(language)
        self.language = language

        self.loader  = ScenarioLoader(scenario_path)
        self.ledger  = CommitmentLedger()
        self.tracker = LocationTracker(self.loader)

        self.agents: dict[str, SuspectAgentKG] = {
            node_id: SuspectAgentKG(self.loader, node_id, self.ledger)
            for node_id in self.loader.get_all_suspect_node_ids()
        }

        self.current_suspect_id: str | None = None
        self.turn = 0
        self._new_location_ids: set[str] = set()

    # ── Briefing ──────────────────────────────────────────────────────

    def get_briefing(self) -> dict:
        """Return case overview for the opening screen."""
        md = self.loader.get_murder_details()
        return {
            "title":    self.loader.get_title(),
            "setting":  self.loader.get_setting(),
            "victim":   md.get("summary", ""),
            "time_of_murder": md.get("time_of_murder", ""),
            "time_discovered": md.get("time_discovered", ""),
            "weapon":   md.get("weapon", ""),
            "scene":    md.get("setting", ""),
            "suspects": [self._suspect_info(nid) for nid in self.agents],
        }

    # ── Suspect management ────────────────────────────────────────────

    def switch_suspect(self, suspect_id: str) -> SuspectInfo:
        if suspect_id not in self.agents:
            raise ValueError(f"Unknown suspect: {suspect_id}")
        self.current_suspect_id = suspect_id
        return self._suspect_info(suspect_id)

    # ── Interrogation ─────────────────────────────────────────────────

    def ask(self, text: str) -> str:
        """
        Send a question to the current suspect and return the full response.
        Use ask_stream() for token-by-token streaming.
        """
        agent = self._current_agent()
        self.turn += 1
        response = agent.get_suspect_response(text)
        self._new_location_ids = set(self._unlock_locations(agent))
        return response

    def ask_stream(self, text: str) -> Generator[str, None, None]:
        """
        Streaming version of ask(). Yields text chunks as they are generated.
        The final chunk is always an empty string signalling completion.
        Requires llm_client to support streaming (not yet implemented).
        """
        # TODO: implement streaming in llm_client.py
        # For now, fall back to a single yield of the full response.
        yield self.ask(text)
        yield ""

    # ── Examine ───────────────────────────────────────────────────────

    def get_examine_options(self) -> dict:
        """Return currently available locations and found items."""
        locations = [
            LocationInfo(
                id=loc_id,
                name=self.loader.get_node_name(loc_id),
                examined=self.tracker.is_examined(loc_id),
                is_new=loc_id in self._new_location_ids,
            )
            for loc_id in self.tracker.get_available_locations()
        ]
        items = [
            ItemInfo(
                id=item_id,
                name=self.loader.nodes[item_id]["properties"].get("name", item_id),
                description=self.loader.nodes[item_id]["properties"].get("description", ""),
            )
            for item_id in self.tracker.get_found_items()
        ]
        return {"locations": locations, "items": items}

    def examine_location(self, location_id: str) -> ExamineResult:
        self._new_location_ids = set()
        result = self.tracker.examine_location(location_id)
        return ExamineResult(
            description=result["description"],
            newly_found=[self._item_info(i) for i in result["newly_found"]],
            already_found=[self._item_info(i) for i in result["already_found"]],
            unlocked_location=None,
        )

    def examine_item(self, item_id: str) -> ItemDetail:
        result = self.tracker.examine_item(item_id)
        self._new_location_ids = (
            {result["unlocked_location"]} if result["unlocked_location"] else set()
        )
        return ItemDetail(
            name=result["name"],
            description=result["description"],
            significance=result["significance"],
            unlocked_location=result["unlocked_location"],
        )

    # ── Indict ────────────────────────────────────────────────────────

    def indict(self, suspect_id: str, reason: str) -> IndictResult:
        if suspect_id not in self.agents:
            raise ValueError(f"Unknown suspect: {suspect_id}")

        agent = self.agents[suspect_id]
        solution = self.loader.data.get("solution", {})
        evaluation = evaluate_indictment(suspect_id, reason, self.loader)
        correct = evaluation["accused_correct"]
        reason_accepted = evaluation["reason_accepted"]
        won = evaluation["won"]

        if won:
            message = solution.get("explanation", "Correct.")
        elif not correct:
            message = f"Wrong. {agent.suspect_name} is not the murderer."
        elif not reason_accepted:
            message = "The suspect is correct, but your reasoning does not establish the case."
        else:
            message = "The indictment fails."

        return IndictResult(
            correct=correct,
            accused_name=agent.suspect_name,
            reason_accepted=reason_accepted,
            won=won,
            message=message,
            evaluation=evaluation,
        )

    # ── State snapshot ────────────────────────────────────────────────

    def get_state(self) -> GameState:
        options = self.get_examine_options()
        return GameState(
            current_suspect_id=self.current_suspect_id,
            suspects=[self._suspect_info(nid) for nid in self.agents],
            available_locations=options["locations"],
            found_items=options["items"],
            turn=self.turn,
        )

    # ── Internal helpers ──────────────────────────────────────────────

    def _current_agent(self) -> SuspectAgentKG:
        if self.current_suspect_id is None:
            raise RuntimeError("No suspect selected. Call switch_suspect() first.")
        return self.agents[self.current_suspect_id]

    def _unlock_locations(self, agent: SuspectAgentKG) -> list:
        return self.tracker.unlock_from_testimony(agent.last_used_edge_ids)

    def _suspect_info(self, node_id: str) -> SuspectInfo:
        return SuspectInfo(
            id=node_id,
            name=self.loader.get_node_name(node_id),
        )

    def _item_info(self, item_id: str) -> ItemInfo:
        props = self.loader.nodes[item_id]["properties"]
        return ItemInfo(
            id=item_id,
            name=props.get("name", item_id),
            description=props.get("description", ""),
        )
