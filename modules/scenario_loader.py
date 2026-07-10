"""
Load a scenario JSON file and provide subgraph extraction for each suspect.
"""

import json


class ScenarioLoader:
    def __init__(self, scenario_path: str):
        with open(scenario_path, encoding="utf-8") as f:
            self.data = json.load(f)

        kg = self.data["knowledge_graph"]

        # id -> node dict
        self.nodes: dict = {n["id"]: n for n in kg["nodes"]}
        # id -> edge dict
        self.edges: dict = {e["id"]: e for e in kg["edges"]}

        self._has_known_by = any(
            "known_by" in e.get("properties", {}) for e in kg["edges"]
        )

        # node_id -> suspect entry (timeline, optional legacy subgraph)
        self.suspects: dict = {s["node_id"]: s for s in self.data["suspects"]}

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_title(self) -> str:
        return self.data.get("title", "")

    def get_setting(self) -> str:
        return self.data.get("setting", "")

    def get_murder_details(self) -> dict:
        return self.data.get("murder_details", {})

    def get_all_suspect_node_ids(self) -> list:
        """Return node_ids in the order defined in suspects[]."""
        return [s["node_id"] for s in self.data["suspects"]]

    def get_node_name(self, node_id: str) -> str:
        node = self.nodes.get(node_id)
        if node:
            return node["properties"].get("name", node_id)
        return node_id

    def get_display_names_ja(self) -> dict:
        return self.data.get("display_names_ja", {})

    # ------------------------------------------------------------------
    # Subgraph extraction
    # ------------------------------------------------------------------

    def get_subgraph(self, node_id: str) -> dict:
        """
        Extract everything a suspect knows.

        Returns:
            {
                "node":            the character node dict,
                "visible_edges":   list of edge dicts the suspect knows,
                "hidden_edges":    list of edge dicts the suspect must not reveal,
                "hidden_edge_ids": set of hidden edge id strings,
                "timeline":        list of {time, action} dicts,
            }
        """
        suspect_entry = self.suspects.get(node_id)
        if suspect_entry is None:
            raise ValueError(f"Suspect node_id '{node_id}' not found in scenario.")

        if self._has_known_by:
            visible_edges = []
            hidden_edges = []
            for edge in self.edges.values():
                if not self._edge_known_by(edge, node_id):
                    continue
                if edge.get("properties", {}).get("hidden_from_detective"):
                    hidden_edges.append(edge)
                else:
                    visible_edges.append(edge)
            hidden_edge_ids = {e["id"] for e in hidden_edges}
        else:
            sub = suspect_entry.get("subgraph", {})
            visible_edges = [
                self.edges[eid] for eid in sub.get("visible_edges", []) if eid in self.edges
            ]
            hidden_edges = [
                self.edges[eid] for eid in sub.get("hidden_edges", []) if eid in self.edges
            ]
            hidden_edge_ids = set(sub.get("hidden_edges", []))

        return {
            "node":            self.nodes[node_id],
            "visible_edges":   visible_edges,
            "hidden_edges":    hidden_edges,
            "hidden_edge_ids": hidden_edge_ids,
            "timeline":        suspect_entry.get("timeline", []),
        }

    def _edge_known_by(self, edge: dict, node_id: str) -> bool:
        props = edge.get("properties", {})
        known_by = props.get("known_by")
        if known_by is None:
            known_by = props.get("visible_to")

        if known_by == "all":
            return True
        if isinstance(known_by, str):
            return known_by == node_id
        if isinstance(known_by, list):
            return node_id in known_by
        return False
