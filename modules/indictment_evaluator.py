"""
Evaluate a reasoned indictment using KG edge extraction + proof-graph scoring.

The LLM maps free text to mentioned KG edge IDs. The final verdict is
rule-based: accused correctness, required proof groups, and score threshold.
"""

from modules.reason_edge_extractor import extract_reason_edges


def _evaluate_groups(mentioned_edge_ids: set, groups: list) -> tuple[list, list, int]:
    passed = []
    failed = []
    score = 0

    for group in groups:
        edge_ids = set(group.get("edge_ids", []))
        matched = sorted(edge_ids & mentioned_edge_ids)
        min_required = int(group.get("min_required", len(edge_ids) or 1))
        passed_group = len(matched) >= min_required
        result = {
            "id": group.get("id", ""),
            "matched_edge_ids": matched,
            "required_edge_ids": sorted(edge_ids),
            "min_required": min_required,
            "weight": int(group.get("weight", 0)),
            "required": bool(group.get("required", False)),
            "description": group.get("description", ""),
        }

        if passed_group:
            score += result["weight"]
            passed.append(result)
        else:
            failed.append(result)

    return passed, failed, score


def _proof_graph_subgraph(groups: list, nodes: dict, edges: dict) -> tuple[dict, dict]:
    """Restrict nodes/edges to what the proof graph actually scores against.

    The extractor only ever needs to recognize mentions of these edges, so
    there's no reason to spend context on the rest of the scenario's graph.
    """
    proof_edge_ids = {edge_id for group in groups for edge_id in group.get("edge_ids", [])}
    scoped_edges = {eid: edges[eid] for eid in proof_edge_ids if eid in edges}

    node_ids = set()
    for edge in scoped_edges.values():
        node_ids.add(edge.get("from"))
        node_ids.add(edge.get("to"))
    scoped_nodes = {nid: nodes[nid] for nid in node_ids if nid in nodes}

    return scoped_nodes, scoped_edges


def evaluate_indictment(
    accused_node_id: str,
    reason_text: str,
    loader,
) -> dict:
    solution = loader.data.get("solution", {})
    proof_graph = solution.get("proof_graph", {})
    groups = proof_graph.get("groups", [])
    minimum_score = int(proof_graph.get("minimum_score", 0))

    accused_correct = accused_node_id == solution.get("killer_node")
    scoped_nodes, scoped_edges = _proof_graph_subgraph(groups, loader.nodes, loader.edges)
    extraction = extract_reason_edges(
        reason_text,
        scoped_nodes,
        scoped_edges,
        display_names=loader.get_display_names_ja(),
    )
    mentioned_edge_ids = set(extraction["mentioned_edge_ids"])

    passed_groups, failed_groups, score = _evaluate_groups(mentioned_edge_ids, groups)
    failed_required_groups = [g for g in failed_groups if g["required"]]

    reason_accepted = not failed_required_groups and score >= minimum_score
    won = accused_correct and reason_accepted

    return {
        "accused_correct": accused_correct,
        "reason_accepted": reason_accepted,
        "won": won,
        "score": score,
        "minimum_score": minimum_score,
        "mentioned_edge_ids": sorted(mentioned_edge_ids),
        "mentioned_edges": extraction.get("mentioned_edges", []),
        "claims": extraction.get("claims", []),
        "confidence_threshold": extraction.get("confidence_threshold"),
        "extraction_error": extraction.get("llm_error"),
        "passed_groups": passed_groups,
        "failed_groups": failed_groups,
        "failed_required_groups": failed_required_groups,
    }
