"""
Builds a KnowledgeGraph (god-KG) deterministically from the story JSON.

No additional LLM call — all information comes from the story generation prompt output.
Called after parse_story() with the same raw JSON dict.
"""

import re
from story_elements.knowledge_graph import KnowledgeGraph, Node, Edge, NodeType, EdgeType


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def build_kg(plot, raw_data: dict) -> KnowledgeGraph:
    """
    Build the god-KG from the Plot object and the raw story JSON.

    Args:
        plot:      Plot object (suspects, victim, murder_details already parsed).
        raw_data:  The full JSON dict returned by the LLM (includes locations, evidence, alibis).

    Returns:
        A KnowledgeGraph with all nodes and edges, including the COMMITTED edge.
    """
    kg = KnowledgeGraph()
    name_to_id: dict[str, str] = {}

    # ── 1. PERSON nodes ──────────────────────────────────────────────────────
    victim_id = _slug(plot.victim.name)
    kg.add_node(Node(
        id=victim_id,
        node_type=NodeType.PERSON,
        name=plot.victim.name,
        properties={"role": "victim", "bio": plot.victim.bio},
    ))
    name_to_id[plot.victim.name] = victim_id

    guilty_suspect = None
    innocent_suspects = []
    for s in plot.suspects:
        sid = _slug(s.name)
        kg.add_node(Node(
            id=sid,
            node_type=NodeType.PERSON,
            name=s.name,
            properties={
                "role": "suspect",
                "bio": s.bio,
                "tags": s.tags,
                "victim_connection": s.victim_connection,
                "guilty": s.guilty,
            },
        ))
        name_to_id[s.name] = sid
        if s.guilty:
            guilty_suspect = s
        else:
            innocent_suspects.append(s)

    # ── 2. LOCATION nodes ────────────────────────────────────────────────────
    for loc in raw_data.get("locations", []):
        loc_id = loc.get("id") or _slug(loc.get("name", "unknown"))
        loc_name = loc.get("name", loc_id)
        kg.add_node(Node(
            id=loc_id,
            node_type=NodeType.LOCATION,
            name=loc_name,
            properties={"description": loc.get("description", "")},
        ))
        name_to_id[loc_name] = loc_id
        name_to_id[loc_id] = loc_id

    # ── 3. ITEM / evidence nodes ─────────────────────────────────────────────
    for item in raw_data.get("evidence", []):
        item_id = item.get("id") or _slug(item.get("name", "unknown"))
        item_name = item.get("name", item_id)
        kg.add_node(Node(
            id=item_id,
            node_type=NodeType.ITEM,
            name=item_name,
            properties={"description": item.get("description", "")},
        ))
        name_to_id[item_name] = item_id
        name_to_id[item_id] = item_id

    # ── 4. Deterministic edges ────────────────────────────────────────────────

    # HAS_MOTIVE for every suspect (from victim_connection field)
    for s in plot.suspects:
        kg.add_edge(Edge(
            source_id=name_to_id[s.name],
            edge_type=EdgeType.HAS_MOTIVE,
            target_id=victim_id,
            note=s.victim_connection,
        ))

    # COMMITTED (god-only) — guilty suspect → victim
    if guilty_suspect:
        kg.add_edge(Edge(
            source_id=name_to_id[guilty_suspect.name],
            edge_type=EdgeType.COMMITTED,
            target_id=victim_id,
            note=plot.murder_details.murder_action,
        ))

    # FOUND_DEAD_IN — victim → crime scene location
    murder_setting_id = _slug(plot.murder_details.murder_setting)
    if murder_setting_id in kg.nodes:
        kg.add_edge(Edge(
            source_id=victim_id,
            edge_type=EdgeType.FOUND_DEAD_IN,
            target_id=murder_setting_id,
        ))

    # Evidence edges: FOUND_IN, OWNED_BY, WRITTEN_BY, KILLED (for murder weapon)
    murder_weapon_slug = _slug(plot.murder_details.murder_weapon)
    for item in raw_data.get("evidence", []):
        item_id = item.get("id") or _slug(item.get("name", "unknown"))

        found_in_id = item.get("found_in")
        if found_in_id and found_in_id in kg.nodes:
            kg.add_edge(Edge(
                source_id=item_id,
                edge_type=EdgeType.FOUND_IN,
                target_id=found_in_id,
            ))

        owned_by_name = item.get("owned_by")
        if owned_by_name and owned_by_name in name_to_id:
            owner_id = name_to_id[owned_by_name]
            kg.add_edge(Edge(
                source_id=item_id,
                edge_type=EdgeType.OWNED_BY,
                target_id=owner_id,
                owner_id=owner_id,
            ))

        written_by_name = item.get("written_by")
        if written_by_name and written_by_name in name_to_id:
            author_id = name_to_id[written_by_name]
            kg.add_edge(Edge(
                source_id=item_id,
                edge_type=EdgeType.WRITTEN_BY,
                target_id=author_id,
            ))

        # KILLED edge for the murder weapon
        if item_id == murder_weapon_slug or item.get("name", "") == plot.murder_details.murder_weapon:
            kg.add_edge(Edge(
                source_id=item_id,
                edge_type=EdgeType.KILLED,
                target_id=victim_id,
                note=plot.murder_details.murder_description,
            ))

    # HAS_ALIBI + WAS_AT for innocent suspects (from alibis field)
    alibis: dict = raw_data.get("alibis", {})
    for s in innocent_suspects:
        alibi_entry = alibis.get(s.name)
        if not alibi_entry:
            continue

        # Support both old format (string) and new format ({"description": ..., "location_id": ...})
        if isinstance(alibi_entry, dict):
            alibi_note = alibi_entry.get("description", "")
            alibi_loc_id = alibi_entry.get("location_id")
        else:
            alibi_note = alibi_entry
            alibi_loc_id = None

        if alibi_note:
            kg.add_edge(Edge(
                source_id=name_to_id[s.name],
                edge_type=EdgeType.HAS_ALIBI,
                target_id=victim_id,
                note=alibi_note,
                owner_id=name_to_id[s.name],
            ))

        if alibi_loc_id and alibi_loc_id in kg.nodes:
            kg.add_edge(Edge(
                source_id=name_to_id[s.name],
                edge_type=EdgeType.WAS_AT,
                target_id=alibi_loc_id,
                note=alibi_note,
                owner_id=name_to_id[s.name],
            ))

    return kg
