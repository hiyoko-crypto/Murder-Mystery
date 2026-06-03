"""
Commitment Ledger — tracks what each suspect has claimed across turns.

Used both as:
  1. LLM input  : summarise past claims so the model stays consistent
  2. Validator  : detect triple-level contradictions after each response
"""

from typing import Optional


class CommitmentLedger:
    def __init__(self):
        # node_id -> list of turn dicts
        self._ledger: dict[str, list] = {}

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add_turn(
        self,
        node_id: str,
        turn: int,
        question: str,
        used_edge_ids: list,
        asserted_triples: list,
        response_summary: str,
    ) -> None:
        self._ledger.setdefault(node_id, []).append({
            "turn":             turn,
            "question":         question,
            "used_edge_ids":    used_edge_ids,
            "asserted_triples": asserted_triples,
            "response_summary": response_summary,
        })

    # ------------------------------------------------------------------
    # Read — LLM input
    # ------------------------------------------------------------------

    def get_ledger_text(self, node_id: str, max_turns: int = 6) -> str:
        """Return a compact summary of recent turns for LLM context."""
        entries = self._ledger.get(node_id, [])
        if not entries:
            return ""
        recent = entries[-max_turns:]
        lines = []
        for e in recent:
            edge_str = ", ".join(e["used_edge_ids"]) if e["used_edge_ids"] else "—"
            lines.append(f"Turn {e['turn']} (edges: {edge_str}): {e['response_summary']}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Validate — contradiction detection
    # ------------------------------------------------------------------

    def check_contradiction(
        self, node_id: str, new_triples: list
    ) -> tuple[bool, Optional[str]]:
        """
        Check whether new_triples contradict any previously committed triple.

        A contradiction is detected when:
          same subject + same relation + different object

        Returns (is_contradiction, reason_string).
        """
        past_triples = []
        for entry in self._ledger.get(node_id, []):
            past_triples.extend(entry.get("asserted_triples", []))

        for new_t in new_triples:
            if len(new_t) < 3:
                continue
            subj, rel, obj = str(new_t[0]), str(new_t[1]), str(new_t[2])
            for past_t in past_triples:
                if len(past_t) < 3:
                    continue
                p_subj, p_rel, p_obj = str(past_t[0]), str(past_t[1]), str(past_t[2])
                if p_subj == subj and p_rel == rel and p_obj != obj:
                    return True, f"矛盾: ({subj}, {rel}, {p_obj}) vs ({subj}, {rel}, {obj})"

        return False, None

    # ------------------------------------------------------------------
    # Serialisation (for save/load)
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return dict(self._ledger)

    @classmethod
    def from_dict(cls, data: dict) -> "CommitmentLedger":
        ledger = cls()
        ledger._ledger = data
        return ledger
