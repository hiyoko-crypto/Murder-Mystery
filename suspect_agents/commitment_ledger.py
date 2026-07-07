"""
Commitment Ledger — tracks what each suspect has claimed across turns.

Used as LLM input: summarise past claims so the model stays consistent.
"""


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
    # Serialisation (for save/load)
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return dict(self._ledger)

    @classmethod
    def from_dict(cls, data: dict) -> "CommitmentLedger":
        ledger = cls()
        ledger._ledger = data
        return ledger
