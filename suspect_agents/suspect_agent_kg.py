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
from modules.i18n import get_lang
from modules.translator import translate_question_to_english, translate_response
from suspect_agents.commitment_ledger import CommitmentLedger
from suspect_agents.semantic_validator import semantic_validate_response
from suspect_agents.validator_kg import validate_response

MAX_RETRIES = 3
SAFE_FALLBACK_RESPONSE = "I need a moment to collect myself. Ask me again, Detective."
DEBUG_VALIDATION = True
ENABLE_SEMANTIC_VALIDATOR = False


class SuspectAgentKG:
    def __init__(self, loader: ScenarioLoader, node_id: str, ledger: CommitmentLedger):
        self.loader   = loader
        self.node_id  = node_id
        self.ledger   = ledger
        self.turn     = 0

        self.subgraph         = loader.get_subgraph(node_id)
        self.suspect_name     = self.subgraph["node"]["properties"]["name"]
        self.visible_edge_ids = {e["id"] for e in self.subgraph["visible_edges"]}
        self.hidden_edge_ids  = self.subgraph["hidden_edge_ids"]
        self.guilty           = self.subgraph["node"]["properties"].get("guilty", False)
        self.last_used_edge_ids: list = []  # updated after each valid response

        if DEBUG_VALIDATION:
            print(f"SUSPECT LOADED: {self.suspect_name} ({'GUILTY' if self.guilty else 'innocent'})")

    # ------------------------------------------------------------------

    def get_suspect_response(self, user_message: str) -> str:
        """
        Generate a validated response to the detective's question.
        Returns the response text (stripped of JSON wrapper).
        """
        self.turn += 1
        self.last_used_edge_ids = []

        lang             = get_lang()
        display_names_ja = self.loader.get_display_names_ja()
        question_for_llm = user_message
        if lang == "ja":
            question_for_llm = translate_question_to_english(
                user_message,
                display_names=display_names_ja,
            )

        ledger_text    = self.ledger.get_self_graph_text(self.node_id)
        system_content = build_system_prompt(self.subgraph, self.loader.nodes, ledger_text)

        system_msg = {"role": "system", "content": system_content}
        user_msg   = {"role": "user",   "content": f"Detective: {question_for_llm}"}

        last_error = None
        for attempt in range(MAX_RETRIES):
            raw = llm_messages([system_msg, user_msg], temperature=0.7, quality=True)

            is_valid, parsed, error = validate_response(
                raw,
                self.visible_edge_ids,
                self.hidden_edge_ids,
            )

            if is_valid:
                response_text    = parsed["response"]
                used_edge_ids    = parsed.get("used_edge_ids", [])
                asserted_triples = parsed.get("asserted_triples", [])

                if ENABLE_SEMANTIC_VALIDATOR:
                    sem_ok, sem_result, sem_error = semantic_validate_response(
                        suspect_name=self.suspect_name,
                        question=question_for_llm,
                        response_text=response_text,
                        visible_edges=self.subgraph["visible_edges"],
                        hidden_edges=self.subgraph["hidden_edges"],
                        nodes=self.loader.nodes,
                        ledger_text=ledger_text,
                        asserted_triples=asserted_triples,
                        is_guilty=self.guilty,
                    )
                    if not sem_ok:
                        last_error = sem_error
                        retry_hint = "Regenerate the answer so it stays consistent with public facts and prior statements."
                        if sem_result:
                            retry_hint = sem_result.get("safe_retry_hint", retry_hint)
                        hint = f"\n\n[Previous output was invalid: {retry_hint}]"
                        user_msg = {"role": "user", "content": f"Detective: {question_for_llm}{hint}"}
                        if DEBUG_VALIDATION:
                            print(f"[SemanticValidator] Attempt {attempt + 1} failed: {sem_error}")
                        continue

                self.last_used_edge_ids = used_edge_ids  # expose for LocationTracker

                summary = (response_text[:100] + "...") if len(response_text) > 100 else response_text
                self.ledger.add_turn(
                    self.node_id, self.turn, question_for_llm,
                    used_edge_ids, asserted_triples, summary
                )

                if attempt > 0:
                    if DEBUG_VALIDATION:
                        print(f"[Validator] OK after {attempt + 1} attempts.")

                if lang == "ja":
                    response_text = translate_response(
                        response_text,
                        display_names=display_names_ja
                    )
                return response_text

            last_error = error
            hint = f"\n\n[Previous output was invalid: {error}. Please output valid JSON again.]"
            user_msg = {"role": "user", "content": f"Detective: {question_for_llm}{hint}"}
            if DEBUG_VALIDATION:
                print(f"[Validator] Attempt {attempt + 1} failed: {error}")

        if DEBUG_VALIDATION:
            print(f"[Validator] All {MAX_RETRIES} attempts failed. Returning safe fallback. Last error: {last_error}")
        if lang == "ja":
            return translate_response(
                SAFE_FALLBACK_RESPONSE,
                display_names=display_names_ja,
            )
        return SAFE_FALLBACK_RESPONSE
