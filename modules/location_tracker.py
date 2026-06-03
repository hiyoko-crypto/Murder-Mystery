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
        rules = loader.get_examine_rules()
        self.loc_rules  = rules.get("locations", {})
        self.item_rules = rules.get("items", {})

        self.known_locations:    set = set()
        self.examined_locations: set = set()
        self.found_items:        set = set()

        # Seed with initially available locations
        for loc_id, r in self.loc_rules.items():
            if r.get("initially_available"):
                self.known_locations.add(loc_id)

    # ------------------------------------------------------------------
    # Testimony-based unlocking
    # ------------------------------------------------------------------

    def unlock_from_testimony(self, used_edge_ids: list) -> list:
        """
        Check used_edge_ids; unlock any location whose node appears as
        from/to on a used edge and has unlock_from_testimony=true.

        Returns list of newly unlocked location IDs.
        """
        newly = []
        for eid in used_edge_ids:
            edge = self.loader.edges.get(eid, {})
            for node_ref in [edge.get("from"), edge.get("to")]:
                if not node_ref:
                    continue
                r = self.loc_rules.get(node_ref, {})
                if r.get("unlock_from_testimony") and node_ref not in self.known_locations:
                    self.known_locations.add(node_ref)
                    newly.append(node_ref)
        return newly

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
        rules = self.loc_rules.get(location_id, {})

        description  = rules.get("description", "Nothing notable here.")
        items_here   = rules.get("items_present", [])
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

        unlocks     = self.item_rules.get(item_id, {}).get("unlocks_location")
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

    def get_available_locations(self) -> list:
        return sorted(self.known_locations)

    def get_found_items(self) -> list:
        return sorted(self.found_items)

    def is_examined(self, location_id: str) -> bool:
        return location_id in self.examined_locations
