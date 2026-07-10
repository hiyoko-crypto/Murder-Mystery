"""
LocationTracker — manages which locations and items the player has discovered.

Unlock triggers:
  1. Item examination chain : examining n_vent_grate unlocks n_vent_shaft
  2. Suspect testimony      : used_edge_ids referencing a location unlocks it
"""

from modules.scenario_loader import ScenarioLoader


class LocationTracker:
    def __init__(self, loader: ScenarioLoader):
        self.loader = loader

        self.known_locations:    set = set()
        self.examined_locations: set = set()
        self.found_items:        set = set()

        # Seed with initially available locations
        for node_id, node in loader.nodes.items():
            if "Location" not in node.get("labels", []):
                continue
            if node["properties"].get("initially_available"):
                self.known_locations.add(node_id)

    # ------------------------------------------------------------------
    # Testimony-based unlocking
    # ------------------------------------------------------------------

    def unlock_from_testimony(self, used_edge_ids: list, speaker_id: str | None = None) -> list:
        """
        Check used_edge_ids; unlock any location whose node appears as
        from/to on a used edge and has unlock_from_testimony=true.

        Returns list of newly unlocked location IDs.
        """
        newly = []
        for eid in used_edge_ids:
            edge = self.loader.edges.get(eid, {})
            if speaker_id is not None:
                node_refs = self._testimony_location_refs(edge, speaker_id)
            else:
                node_refs = [edge.get("from"), edge.get("to")]

            for node_ref in node_refs:
                if not node_ref:
                    continue
                node = self.loader.nodes.get(node_ref, {})
                if node.get("properties", {}).get("unlock_from_testimony") and node_ref not in self.known_locations:
                    self.known_locations.add(node_ref)
                    newly.append(node_ref)
        return newly

    def _testimony_location_refs(self, edge: dict, speaker_id: str) -> list:
        if edge.get("from") == speaker_id and edge.get("rel") == "WAS_IN":
            return [edge.get("to")]

        event_id = None
        if edge.get("from") == speaker_id and edge.get("rel") in {
            "PARTICIPATED_IN",
            "CLAIMED_PARTICIPATION_IN",
        }:
            event_id = edge.get("to")
        elif self._speaker_participated_in_event(speaker_id, edge.get("from")):
            event_id = edge.get("from")

        if not event_id:
            return []

        refs = []
        for candidate in self.loader.edges.values():
            if candidate.get("from") != event_id:
                continue
            if candidate.get("rel") in {"OCCURRED_AT", "ENDED_AT", "STARTED_AT"}:
                refs.append(candidate.get("to"))
        return refs

    def _speaker_participated_in_event(self, speaker_id: str, event_id: str | None) -> bool:
        if not event_id:
            return False
        for edge in self.loader.edges.values():
            if edge.get("from") != speaker_id or edge.get("to") != event_id:
                continue
            if edge.get("rel") in {"PARTICIPATED_IN", "CLAIMED_PARTICIPATION_IN"}:
                return True
        return False

    # ------------------------------------------------------------------
    # Location examination
    # ------------------------------------------------------------------

    def examine_location(self, location_id: str) -> dict:
        """
        Examine a location: reveal items present, mark as examined.

        Returns:
            {
                "description":  str,
                "newly_found":  list of item IDs first discovered here,
                "already_found":list of item IDs already in found_items,
            }
        """
        self.examined_locations.add(location_id)
        node = self.loader.nodes.get(location_id, {})

        description  = node.get("properties", {}).get("room_description", "Nothing notable here.")
        items_here   = self.get_catalog_items(location_id)
        newly_found  = []
        already_found = []

        for item_id in items_here:
            if item_id not in self.found_items:
                self.found_items.add(item_id)
                newly_found.append(item_id)
            else:
                already_found.append(item_id)

        return {
            "description":  description,
            "newly_found":  newly_found,
            "already_found": already_found,
        }

    # ------------------------------------------------------------------
    # Item examination
    # ------------------------------------------------------------------

    def examine_item(self, item_id: str) -> dict:
        """
        Examine a discovered item. May unlock a new location.

        Returns:
            {
                "name":             str,
                "description":      str,
                "significance":     str,
                "unlocked_location": str | None,
            }
        """
        node  = self.loader.nodes.get(item_id, {})
        props = node.get("properties", {})

        unlocks = None
        for edge in self.loader.edges.values():
            if edge.get("from") == item_id and edge.get("rel") == "REVEALS":
                unlocks = edge.get("to")
                break

        newly_unlocked = None
        if unlocks and unlocks not in self.known_locations:
            self.known_locations.add(unlocks)
            newly_unlocked = unlocks

        return {
            "name":              props.get("name", item_id),
            "description":       props.get("description", ""),
            "significance":      props.get("significance", ""),
            "unlocked_location": newly_unlocked,
        }

    # ------------------------------------------------------------------
    # UI helpers
    # ------------------------------------------------------------------

    def get_catalog_items(self, location_id: str) -> list:
        """Full item catalog for a location, regardless of found-state."""
        return [
            edge["from"]
            for edge in self.loader.edges.values()
            if edge.get("rel") == "FOUND_IN" and edge.get("to") == location_id
        ]

    def get_available_locations(self) -> list:
        return sorted(self.known_locations)

    def get_found_items(self) -> list:
        return sorted(self.found_items)

    def is_examined(self, location_id: str) -> bool:
        return location_id in self.examined_locations
