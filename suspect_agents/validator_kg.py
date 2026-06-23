"""
Validator for KG-grounded suspect responses.

Checks:
  1. JSON parse validity
  2. Required fields present
  3. used_edge_ids type and visible-edge subset
  4. hidden_edges not leaked in used_edge_ids
  5. asserted_triples type
  6. Commitment ledger contradiction
"""

import json
from typing import Optional
from suspect_agents.commitment_ledger import CommitmentLedger


def _extract_json(text: str) -> str:
    """Extract JSON object from text that may contain surrounding prose."""
    text = text.strip()
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


def validate_response(
    raw_output: str,
    visible_edge_ids: set,
    hidden_edge_ids: set,
    ledger: CommitmentLedger,
    node_id: str,
) -> tuple[bool, Optional[dict], Optional[str]]:
    """
    Validate a raw LLM output string.

    Returns:
        (is_valid, parsed_dict, error_message)
        parsed_dict is None when is_valid is False.
    """
    cleaned = _extract_json(raw_output)

    # 1. JSON parse
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return False, None, f"JSONパースエラー: {e}"

    if not isinstance(parsed, dict):
        return False, None, "LLM出力JSONはオブジェクトである必要があります"

    # 2. Required fields
    if "response" not in parsed or not isinstance(parsed["response"], str):
        return False, None, "'response' フィールドが存在しないか無効です"
    if "used_edge_ids" not in parsed:
        return False, None, "'used_edge_ids' フィールドが存在しません"
    if "asserted_triples" not in parsed:
        return False, None, "'asserted_triples' フィールドが存在しません"

    # 3. used_edge_ids type and allowed range
    used_edge_ids = parsed["used_edge_ids"]
    if not isinstance(used_edge_ids, list):
        return False, None, "'used_edge_ids' は配列である必要があります"
    if not all(isinstance(eid, str) for eid in used_edge_ids):
        return False, None, "'used_edge_ids' の各要素は文字列である必要があります"

    used = set(used_edge_ids)
    leaked = used & hidden_edge_ids
    if leaked:
        return False, None, f"hidden_edges が漏洩しています: {sorted(leaked)}"

    unsupported_edges = used - visible_edge_ids
    if unsupported_edges:
        return False, None, f"使用できないedge IDが含まれています: {sorted(unsupported_edges)}"

    # 4. asserted_triples type
    asserted_triples = parsed["asserted_triples"]
    if not isinstance(asserted_triples, list):
        return False, None, "'asserted_triples' は配列である必要があります"
    for triple in asserted_triples:
        if not isinstance(triple, list) or len(triple) != 3:
            return False, None, "'asserted_triples' の各要素は長さ3の配列である必要があります"
        if not all(isinstance(part, str) for part in triple):
            return False, None, "'asserted_triples' の各要素は文字列である必要があります"

    # 5. Ledger contradiction
    contradicted, reason = ledger.check_contradiction(
        node_id, asserted_triples
    )
    if contradicted:
        return False, None, f"Ledger矛盾: {reason}"

    return True, parsed, None
