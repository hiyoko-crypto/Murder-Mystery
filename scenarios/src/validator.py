"""Deterministic solvability validator for the project's detective-game JSON.

The validator uses the scenario's existing ``solution.proof_graph`` scoring
semantics. It does NOT invent separate per-suspect proof sets.

Knowledge acquisition is an optimistic/oracle simulation:
- ``known_by: "all"`` edges are public and acquired at the beginning.
- An edge known by one or more characters can be acquired by interrogation,
  unless ``hidden_from_detective`` is true.
- ``player_discovery`` edges are acquired when their target can be inspected:
    * examine_location -> the target location is currently accessible;
    * examine_item -> the target item/node is already known/discovered.
- Nodes marked ``initially_available`` are available locations from the start.
- A ``REVEALS`` relationship can open the target location once its source is known.
- Locations marked ``unlock_from_testimony`` become inspectable when an acquired
  testimony/interrogation edge references them.

This is deliberately an upper-bound test: it assumes the player can interrogate
all knowledge holders and obtain everything they know that is not explicitly
hidden from the detective. It does not simulate natural-language dialogue,
player skill, or whether a character would voluntarily disclose a fact.

Minimal use
-----------

    from validator import validate_scenario
    report = validate_scenario("the_final_act.json")
    print(report["status"], report["score"])

CLI
---

    python validator.py the_final_act.json --report validation_report.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple, Union

JSONSource = Union[Dict[str, Any], str, Path]


class ScenarioValidationError(ValueError):
    """Raised when scenario JSON is malformed or lacks required structures."""


def _load_scenario(source: JSONSource) -> Dict[str, Any]:
    if isinstance(source, dict):
        return source
    path = Path(source)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ScenarioValidationError("Scenario root must be a JSON object")
    return data


def _is_hidden(edge: Mapping[str, Any]) -> bool:
    props = edge.get("properties") or {}
    return props.get("hidden_from_detective") is True


def _known_by(edge: Mapping[str, Any]) -> Any:
    props = edge.get("properties") or {}
    return props.get("known_by")


def _normalise_known_by(value: Any) -> Set[str]:
    if isinstance(value, str):
        return {value.lower()} if value.lower() == "all" else {value}
    if isinstance(value, list):
        return {str(item) for item in value if item is not None}
    return set()


def _node_props(node: Mapping[str, Any]) -> Dict[str, Any]:
    props = node.get("properties")
    return props if isinstance(props, dict) else {}


def _node_is_location(node: Mapping[str, Any]) -> bool:
    labels = node.get("labels", [])
    return isinstance(labels, list) and "Location" in labels


def _iter_player_discovery(edge: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
    props = edge.get("properties") or {}
    trigger = props.get("player_discovery")
    return trigger if isinstance(trigger, dict) else None


def _edge_endpoints(edge: Mapping[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    return edge.get("from"), edge.get("to")


def _solution_groups(scenario: Mapping[str, Any]) -> Tuple[List[Dict[str, Any]], int, List[str]]:
    solution = scenario.get("solution")
    if not isinstance(solution, dict):
        raise ScenarioValidationError("Missing or invalid top-level 'solution' object")

    proof_graph = solution.get("proof_graph")
    if isinstance(proof_graph, dict) and isinstance(proof_graph.get("groups"), list):
        groups = proof_graph["groups"]
        if not groups:
            raise ScenarioValidationError("solution.proof_graph.groups must not be empty")
        minimum_score = int(proof_graph.get("minimum_score", 0))
        return groups, minimum_score, []

    # Backward-compatible fallback for older files without proof_graph.
    key_edges = solution.get("key_evidence_edges", [])
    if isinstance(key_edges, list) and key_edges:
        fallback = [{
            "id": "legacy_key_evidence",
            "edge_ids": key_edges,
            "min_required": len(key_edges),
            "weight": 1,
            "required": True,
            "description": "All legacy key_evidence_edges must be acquired."
        }]
        return fallback, 1, [
            "No solution.proof_graph found; using key_evidence_edges as an all-required fallback."
        ]
    raise ScenarioValidationError(
        "solution.proof_graph.groups is missing or empty, and no legacy key_evidence_edges exist"
    )


def _evaluate_proof_graph(
    acquired_edge_ids: Set[str],
    groups: Sequence[Mapping[str, Any]],
    minimum_score: int,
    existing_edge_ids: Set[str],
) -> Dict[str, Any]:
    group_reports: List[Dict[str, Any]] = []
    total_score = 0
    required_groups_satisfied = True
    invalid_solution_edge_ids: Set[str] = set()

    for group in groups:
        group_id = str(group.get("id", f"group_{len(group_reports) + 1}"))
        edge_ids = [str(x) for x in group.get("edge_ids", [])]
        min_required = int(group.get("min_required", 1))
        weight = int(group.get("weight", 1))
        required = bool(group.get("required", False))

        missing_from_graph = sorted(set(edge_ids) - existing_edge_ids)
        invalid_solution_edge_ids.update(missing_from_graph)
        acquired_in_group = sorted(set(edge_ids) & acquired_edge_ids)
        missing_for_group = sorted(set(edge_ids) - acquired_edge_ids)
        satisfied = len(acquired_in_group) >= min_required

        if satisfied:
            total_score += weight
        if required and not satisfied:
            required_groups_satisfied = False

        group_reports.append({
            "id": group_id,
            "edge_ids": edge_ids,
            "acquired_edge_ids": acquired_in_group,
            "missing_edge_ids": missing_for_group,
            "unknown_edge_ids": missing_from_graph,
            "acquired_count": len(acquired_in_group),
            "min_required": min_required,
            "weight": weight,
            "required": required,
            "satisfied": satisfied,
            "description": group.get("description"),
        })

    solved = required_groups_satisfied and total_score >= minimum_score
    return {
        "solvable": solved,
        "score": total_score,
        "minimum_score": minimum_score,
        "required_groups_satisfied": required_groups_satisfied,
        "groups": group_reports,
        "unknown_solution_edge_ids": sorted(invalid_solution_edge_ids),
    }


def validate_scenario(
    scenario_source: JSONSource,
    *,
    assume_all_character_knowledge_obtainable: bool = True,
    interrogatable_actor_ids: Optional[Iterable[str]] = None,
    initial_location_ids: Optional[Iterable[str]] = None,
    max_iterations: int = 1000,
) -> Dict[str, Any]:
    """Validate whether the scenario's own proof_graph can be satisfied.

    Parameters
    ----------
    scenario_source:
        Complete scenario dict or path to its JSON file.
    assume_all_character_knowledge_obtainable:
        If True (recommended for the requested ideal-player test), every edge
        whose ``known_by`` list contains an interrogatable actor is acquirable,
        unless explicitly marked ``hidden_from_detective: true``.
    interrogatable_actor_ids:
        Optional actor allow-list. Defaults to all IDs appearing in ``known_by``
        lists plus IDs in the top-level ``suspects`` array.
    initial_location_ids:
        Optional additional locations accessible at game start. Node-level
        ``properties.initially_available: true`` is always respected.
    max_iterations:
        Safety limit for fixed-point expansion; normally the graph converges in
        a handful of iterations.

    Returns
    -------
    dict
        JSON-serialisable report with SOLVABLE / UNSOLVABLE / INVALID status,
        edge acquisition log, proof group scores, and blocked required edges.
    """
    scenario = _load_scenario(scenario_source)
    kg = scenario.get("knowledge_graph")
    if not isinstance(kg, dict):
        raise ScenarioValidationError("Missing or invalid 'knowledge_graph' object")

    nodes_list = kg.get("nodes")
    edges_list = kg.get("edges")
    if not isinstance(nodes_list, list) or not isinstance(edges_list, list):
        raise ScenarioValidationError("knowledge_graph.nodes and .edges must be arrays")

    nodes: Dict[str, Dict[str, Any]] = {}
    duplicate_node_ids: List[str] = []
    for node in nodes_list:
        if not isinstance(node, dict) or not isinstance(node.get("id"), str):
            continue
        node_id = node["id"]
        if node_id in nodes:
            duplicate_node_ids.append(node_id)
        nodes[node_id] = node

    edges: Dict[str, Dict[str, Any]] = {}
    duplicate_edge_ids: List[str] = []
    malformed_edges: List[str] = []
    for edge in edges_list:
        if not isinstance(edge, dict) or not isinstance(edge.get("id"), str):
            malformed_edges.append("edge without string id")
            continue
        edge_id = edge["id"]
        if edge_id in edges:
            duplicate_edge_ids.append(edge_id)
        edges[edge_id] = edge
        src, dst = _edge_endpoints(edge)
        if not src or not dst or src not in nodes or dst not in nodes:
            malformed_edges.append(edge_id)

    groups, minimum_score, notes = _solution_groups(scenario)
    existing_edge_ids = set(edges)

    # Validate solution references before starting the expansion.
    proof_edge_ids = {
        str(edge_id)
        for group in groups
        for edge_id in group.get("edge_ids", [])
    }
    solution = scenario.get("solution", {})
    key_evidence_edge_ids = {
        str(edge_id) for edge_id in solution.get("key_evidence_edges", [])
    } if isinstance(solution, dict) else set()
    red_herring_edge_ids = {
        str(edge_id) for edge_id in solution.get("red_herring_edges", [])
    } if isinstance(solution, dict) else set()
    unknown_solution_ids = sorted((proof_edge_ids | key_evidence_edge_ids | red_herring_edge_ids) - existing_edge_ids)

    # Characters explicitly mentioned in known_by lists are potential knowledge holders.
    known_by_actor_ids: Set[str] = set()
    for edge in edges.values():
        value = _known_by(edge)
        if isinstance(value, list):
            known_by_actor_ids.update(str(x) for x in value if x is not None)
        elif isinstance(value, str) and value.lower() != "all":
            known_by_actor_ids.add(value)

    suspect_ids: Set[str] = set()
    for item in scenario.get("suspects", []) or []:
        if isinstance(item, dict) and item.get("node_id"):
            suspect_ids.add(str(item["node_id"]))

    if interrogatable_actor_ids is None:
        actors = suspect_ids | known_by_actor_ids
    else:
        actors = {str(x) for x in interrogatable_actor_ids}

    # Initial locations and items that are available to inspect.
    accessible_locations: Set[str] = {
        node_id for node_id, node in nodes.items()
        if _node_props(node).get("initially_available") is True
        and _node_is_location(node)
    }
    if initial_location_ids:
        accessible_locations.update(str(x) for x in initial_location_ids)

    known_nodes: Set[str] = set(actors)
    known_nodes.update(accessible_locations)
    acquired_edges: Set[str] = set()
    acquisition_log: List[Dict[str, Any]] = []
    acquired_by: Dict[str, str] = {}

    def add_edge(edge_id: str, channel: str, trigger: Optional[str] = None) -> bool:
        """Acquire an edge once and update node/location knowledge."""
        if edge_id in acquired_edges:
            return False
        edge = edges[edge_id]
        if _is_hidden(edge):
            return False
        acquired_edges.add(edge_id)
        acquired_by[edge_id] = channel
        src, dst = _edge_endpoints(edge)
        if src:
            known_nodes.add(src)
        if dst:
            known_nodes.add(dst)

        # Testimony/interrogation can unlock locations marked as testimony-gated.
        is_testimony = channel == "interrogation" or (
            channel == "player_discovery" and trigger is not None
            and str(trigger).lower().startswith(("interrogate:", "ask_character:", "talk_to_character:"))
        )
        if is_testimony:
            for endpoint in (src, dst):
                if endpoint in nodes and _node_is_location(nodes[endpoint]):
                    if _node_props(nodes[endpoint]).get("unlock_from_testimony") is True:
                        accessible_locations.add(endpoint)

        acquisition_log.append({
            "edge_id": edge_id,
            "via": channel,
            "trigger": trigger,
        })
        return True

    # Start with public facts. Explicit hidden flag has priority over public metadata.
    for edge_id, edge in edges.items():
        if _is_hidden(edge):
            continue
        if "all" in _normalise_known_by(_known_by(edge)):
            add_edge(edge_id, "public", "known_by=all")

    # Idealised interrogation: obtain each non-hidden relation known by a character.
    if assume_all_character_knowledge_obtainable:
        for edge_id, edge in edges.items():
            if _is_hidden(edge) or edge_id in acquired_edges:
                continue
            holders = _normalise_known_by(_known_by(edge))
            if holders and "all" not in holders and holders.intersection(actors):
                add_edge(edge_id, "interrogation", ",".join(sorted(holders.intersection(actors))))

    # Fixed-point expansion: inspect all currently accessible locations/items,
    # then process reveal/unlock-style structural edges. Repeat until no change.
    supported_location_methods = {"examine_location", "inspect_location"}
    supported_item_methods = {"examine_item", "inspect_item"}
    structural_reveal_relations = {"REVEALS", "UNLOCKS", "OPENS", "OPENS_ACCESS_TO"}

    iteration = 0
    changed = True
    while changed and iteration < max_iterations:
        iteration += 1
        changed = False

        for edge_id, edge in edges.items():
            if edge_id in acquired_edges or _is_hidden(edge):
                continue

            # Some schema edges explicitly reveal a new location/node and do not
            # carry known_by or player_discovery (e.g. n_vent_grate REVEALS shaft).
            relation = str(edge.get("rel", "")).upper()
            src, dst = _edge_endpoints(edge)
            if relation in structural_reveal_relations and src in known_nodes:
                if add_edge(edge_id, "structural_reveal", f"{src} --{relation}--> {dst}"):
                    changed = True
                    if dst in nodes and _node_is_location(nodes[dst]):
                        accessible_locations.add(dst)
                    continue

            trigger = _iter_player_discovery(edge)
            if trigger:
                method = str(trigger.get("method", "")).lower()
                target = trigger.get("target")
                can_discover = False
                if method in supported_location_methods and target in accessible_locations:
                    can_discover = True
                elif method in supported_item_methods and target in known_nodes:
                    can_discover = True
                elif method in {"interrogate", "ask_character", "talk_to_character"}:
                    if target in actors and assume_all_character_knowledge_obtainable:
                        can_discover = True
                if can_discover:
                    if add_edge(edge_id, "player_discovery", f"{method}:{target}"):
                        changed = True
                    continue

    proof_report = _evaluate_proof_graph(
        acquired_edges,
        groups,
        minimum_score,
        existing_edge_ids,
    )

    # Required proof edges that were not acquired are useful diagnostics.
    required_group_edges: Set[str] = set()
    for group in groups:
        if bool(group.get("required", False)):
            required_group_edges.update(str(x) for x in group.get("edge_ids", []))
    missing_required_edges = sorted(required_group_edges - acquired_edges)
    inaccessible_edges = sorted(
        edge_id for edge_id in proof_edge_ids
        if edge_id not in acquired_edges and edge_id in edges and not _is_hidden(edges[edge_id])
    )
    hidden_proof_edges = sorted(
        edge_id for edge_id in proof_edge_ids
        if edge_id in edges and _is_hidden(edges[edge_id])
    )
    hidden_key_evidence_edges = sorted(
        edge_id for edge_id in key_evidence_edge_ids
        if edge_id in edges and _is_hidden(edges[edge_id])
    )
    inaccessible_key_evidence_edges = sorted(
        edge_id for edge_id in key_evidence_edge_ids
        if edge_id in edges and edge_id not in acquired_edges and not _is_hidden(edges[edge_id])
    )

    structural_errors = []
    if duplicate_node_ids:
        structural_errors.append(f"Duplicate node IDs: {sorted(set(duplicate_node_ids))}")
    if duplicate_edge_ids:
        structural_errors.append(f"Duplicate edge IDs: {sorted(set(duplicate_edge_ids))}")
    if malformed_edges:
        structural_errors.append(f"Edges with missing/invalid endpoints: {sorted(set(malformed_edges))}")
    if unknown_solution_ids:
        structural_errors.append(f"Solution references unknown Edge IDs: {unknown_solution_ids}")

    expansion_incomplete = iteration >= max_iterations and changed
    if structural_errors:
        status = "INVALID"
    elif expansion_incomplete:
        status = "INCONCLUSIVE"
    else:
        status = "SOLVABLE" if proof_report["solvable"] else "UNSOLVABLE"

    return {
        "scenario_id": scenario.get("scenario_id"),
        "title": scenario.get("title"),
        "status": status,
        "solvable": status == "SOLVABLE",
        "assumptions": {
            "assume_all_character_knowledge_obtainable": assume_all_character_knowledge_obtainable,
            "hidden_from_detective_edges_are_never_directly_acquired": True,
            "initially_available_locations_are_open": True,
            "testimony_unlocks_unlock_from_testimony_locations": True,
            "player_discovery_requires_its_target_to_be_accessible": True,
        },
        "iteration_count": iteration,
        "initial_locations": sorted({
            node_id for node_id, node in nodes.items()
            if _node_props(node).get("initially_available") is True and _node_is_location(node)
        } | (set(str(x) for x in initial_location_ids) if initial_location_ids else set())),
        "interrogated_actor_ids": sorted(actors) if assume_all_character_knowledge_obtainable else [],
        "accessible_locations": sorted(accessible_locations),
        "known_nodes": sorted(known_nodes),
        "acquired_edge_ids": sorted(acquired_edges),
        "acquisition_log": acquisition_log,
        "score": proof_report["score"],
        "minimum_score": proof_report["minimum_score"],
        "required_groups_satisfied": proof_report["required_groups_satisfied"],
        "proof_groups": proof_report["groups"],
        "missing_required_edges": missing_required_edges,
        "inaccessible_proof_edges": inaccessible_edges,
        "hidden_proof_edges": hidden_proof_edges,
        "key_evidence_edge_ids": sorted(key_evidence_edge_ids),
        "hidden_key_evidence_edges": hidden_key_evidence_edges,
        "inaccessible_key_evidence_edges": inaccessible_key_evidence_edges,
        "red_herring_edge_ids": sorted(red_herring_edge_ids),
        "unknown_solution_edge_ids": proof_report["unknown_solution_edge_ids"],
        "structural_errors": structural_errors,
        "notes": notes + ([
            f"Expansion stopped at max_iterations={max_iterations}; solvability is inconclusive."
        ] if expansion_incomplete else []),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate detective-game scenario solvability.")
    parser.add_argument("scenario", help="Path to scenario JSON")
    parser.add_argument("--report", help="Optional path to write the validation report JSON")
    parser.add_argument(
        "--no-interrogation",
        action="store_true",
        help="Do not assume that character knowledge can be obtained by interrogation.",
    )
    args = parser.parse_args()

    report = validate_scenario(
        args.scenario,
        assume_all_character_knowledge_obtainable=not args.no_interrogation,
    )
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(rendered + "\n", encoding="utf-8")
        print(f"Report written to: {args.report}")
    print(rendered)


if __name__ == "__main__":
    main()
