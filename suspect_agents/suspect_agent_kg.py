"""
KG-grounded SuspectAgent.

Replaces the RAG/ChromaDB approach with:
  - Subgraph triples as structured context
  - hidden_edges passed with prohibition instruction
  - Commitment Ledger for cross-turn consistency
  - Validator for output checking
"""

from modules.scenario_loader import ScenarioLoader
from modules.subgraph_to_prompt import build_system_prompt
from modules.llm_client import llm_messages
from suspect_agents.commitment_ledger import CommitmentLedger
from suspect_agents.validator_kg import validate_response

MAX_RETRIES = 3


class SuspectAgentKG:
    def __init__(self, loader: ScenarioLoader, node_id: str, ledger: CommitmentLedger):
        self.loader   = loader
        self.node_id  = node_id
        self.ledger   = ledger
        self.turn     = 0

        self.subgraph         = loader.get_subgraph(node_id)
        self.suspect_name     = self.subgraph["node"]["properties"]["name"]
        self.hidden_edge_ids  = self.subgraph["hidden_edge_ids"]
        self.guilty           = self.subgraph["node"]["properties"].get("guilty", False)
        self.last_used_edge_ids: list = []  # updated after each valid response

        print(f"SUSPECT LOADED: {self.suspect_name} ({'GUILTY' if self.guilty else 'innocent'})")

    # ------------------------------------------------------------------

    def get_suspect_response(self, user_message: str) -> str:
        """
        Generate a validated response to the detective's question.
        Returns the response text (stripped of JSON wrapper).
        """
        self.turn += 1

        ledger_text    = self.ledger.get_ledger_text(self.node_id)
        system_content = build_system_prompt(self.subgraph, self.loader.nodes, ledger_text)

        system_msg = {"role": "system", "content": system_content}
        user_msg   = {"role": "user",   "content": f"Detective: {user_message}"}

        last_error = None
        for attempt in range(MAX_RETRIES):
            raw = llm_messages([system_msg, user_msg], temperature=0.7, quality=True)

            is_valid, parsed, error = validate_response(
                raw, self.hidden_edge_ids, self.ledger, self.node_id
            )

            if is_valid:
                response_text    = parsed["response"]
                used_edge_ids    = parsed.get("used_edge_ids", [])
                asserted_triples = parsed.get("asserted_triples", [])

                self.last_used_edge_ids = used_edge_ids  # expose for LocationTracker

                summary = (response_text[:100] + "...") if len(response_text) > 100 else response_text
                self.ledger.add_turn(
                    self.node_id, self.turn, user_message,
                    used_edge_ids, asserted_triples, summary
                )

                if attempt > 0:
                    print(f"[Validator] OK after {attempt + 1} attempts.")
                return response_text

            last_error = error
            hint = f"\n\n[前回の出力が無効でした: {error}。正しいJSON形式で再度出力してください。]"
            user_msg = {"role": "user", "content": f"Detective: {user_message}{hint}"}
            print(f"[Validator] Attempt {attempt + 1} failed: {error}")

        # All retries exhausted — return raw text as fallback
        print(f"[Validator] All {MAX_RETRIES} attempts failed. Returning raw output.")
        return raw
