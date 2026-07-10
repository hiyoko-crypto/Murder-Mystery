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

    def get_self_graph_text(self, node_id: str, max_turns: int = 6) -> str:
        """
        Render this suspect's own asserted_triples from recent turns as a
        small triple graph, grouped by turn, e.g.:

            Turn 2:
              Elena --[WAS_IN]--> Elena's Dressing Room @ 7:00 PM
            Turn 5:
              Elena --[OWNS]--> Silver Compact

        This is the suspect's own self-reported claims, not verified KG
        facts — kept separate from the real subgraph the prompt is built
        from.
        """
        entries = self._ledger.get(node_id, [])[-max_turns:]
        lines = []
        for e in entries:
            triples = [t for t in e.get("asserted_triples", []) if len(t) == 3]
            if not triples:
                continue
            lines.append(f"Turn {e['turn']}:")
            for subj, rel, obj in triples:
                lines.append(f"  {subj} --[{rel}]--> {obj}")
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
