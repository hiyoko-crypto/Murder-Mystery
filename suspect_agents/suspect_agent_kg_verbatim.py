"""
Experimental variant of SuspectAgentKG — an experiment, not part of the shipped game.

Identical to suspect_agent_kg.py (full structured subgraph, hidden/visible split,
grounding instructions, validator + retry) EXCEPT for how the suspect "remembers"
what they already told the detective: instead of CommitmentLedger's structured
self-graph (asserted_triples rendered as triples), this variant resends the
verbatim prior turns as real chat history, the way the legacy RAG agent
(suspect_agent.py) does. This isolates "structured triple summary vs. verbatim
history" as the only variable against the shipped agent.
"""

from modules.scenario_loader import ScenarioLoader
from modules.subgraph_to_prompt import build_system_prompt
from modules.llm_client import llm_messages
from modules.i18n import get_lang
from modules.translator import translate_question_to_english, translate_response
from suspect_agents.validator_kg import validate_response

MAX_RETRIES = 3
SAFE_FALLBACK_RESPONSE = "I need a moment to collect myself. Ask me again, Detective."
DEBUG_VALIDATION = True


class SuspectAgentKGVerbatim:
    def __init__(self, loader: ScenarioLoader, node_id: str):
        self.loader = loader
        self.node_id = node_id
        self.turn = 0
        self.chat_history: list = []  # plain [{"role": ..., "content": ...}, ...]

        self.subgraph = loader.get_subgraph(node_id)
        self.suspect_name = self.subgraph["node"]["properties"]["name"]
        self.visible_edge_ids = {e["id"] for e in self.subgraph["visible_edges"]}
        self.hidden_edge_ids = self.subgraph["hidden_edge_ids"]
        self.guilty = self.subgraph["node"]["properties"].get("guilty", False)
        self.last_used_edge_ids: list = []

        # No ledger_text -- the "[Your own prior statements]" block is omitted
        # entirely; verbatim chat history plays that role instead. Also skip
        # asserted_triples: nothing reads it in this variant, so asking the
        # LLM to produce it just wastes prompt/output budget.
        self.system_content = build_system_prompt(
            self.subgraph, self.loader.nodes, "", include_asserted_triples=False
        )

        if DEBUG_VALIDATION:
            print(f"SUSPECT LOADED (verbatim-history variant): {self.suspect_name} ({'GUILTY' if self.guilty else 'innocent'})")

    def get_suspect_response(self, user_message: str) -> str:
        self.turn += 1
        self.last_used_edge_ids = []

        lang = get_lang()
        display_names_ja = self.loader.get_display_names_ja()
        question_for_llm = user_message
        if lang == "ja":
            question_for_llm = translate_question_to_english(user_message, display_names=display_names_ja)

        system_msg = {"role": "system", "content": self.system_content}
        user_msg = {"role": "user", "content": f"Detective: {question_for_llm}"}

        last_error = None
        for attempt in range(MAX_RETRIES):
            messages = [system_msg] + self.chat_history + [user_msg]
            raw = llm_messages(messages, temperature=0.7, quality=True)

            is_valid, parsed, error = validate_response(
                raw, self.visible_edge_ids, self.hidden_edge_ids, require_asserted_triples=False
            )

            if is_valid:
                response_text = parsed["response"]
                used_edge_ids = parsed.get("used_edge_ids", [])

                self.last_used_edge_ids = used_edge_ids

                # Store the PLAIN question/answer (not the JSON wrapper) as
                # verbatim history, exactly like the legacy RAG agent does.
                self.chat_history.append({"role": "user", "content": f"Detective: {question_for_llm}"})
                self.chat_history.append({"role": "assistant", "content": response_text})

                if attempt > 0 and DEBUG_VALIDATION:
                    print(f"[Validator] OK after {attempt + 1} attempts.")

                if lang == "ja":
                    response_text = translate_response(response_text, display_names=display_names_ja)
                return response_text

            last_error = error
            hint = f"\n\n[Previous output was invalid: {error}. Please output valid JSON again.]"
            user_msg = {"role": "user", "content": f"Detective: {question_for_llm}{hint}"}
            if DEBUG_VALIDATION:
                print(f"[Validator] Attempt {attempt + 1} failed: {error}")

        if DEBUG_VALIDATION:
            print(f"[Validator] All {MAX_RETRIES} attempts failed. Returning safe fallback. Last error: {last_error}")
        if lang == "ja":
            return translate_response(SAFE_FALLBACK_RESPONSE, display_names=display_names_ja)
        return SAFE_FALLBACK_RESPONSE
