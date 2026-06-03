"""
Validator for KG-grounded suspect responses.

Checks:
  1. JSON parse validity
  2. Required fields present
  3. hidden_edges not leaked in used_edge_ids
  4. Commitment ledger contradiction
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

    # 2. Required fields
    if "response" not in parsed or not isinstance(parsed["response"], str):
        return False, None, "'response' フィールドが存在しないか無効です"

    parsed.setdefault("used_edge_ids", [])
    parsed.setdefault("asserted_triples", [])

    # 3. Hidden edge leakage
    used    = set(parsed["used_edge_ids"])
    leaked  = used & hidden_edge_ids
    if leaked:
        return False, None, f"hidden_edges が漏洩しています: {leaked}"

    # 4. Ledger contradiction
    contradicted, reason = ledger.check_contradiction(
        node_id, parsed["asserted_triples"]
    )
    if contradicted:
        return False, None, f"Ledger矛盾: {reason}"

    return True, parsed, None
