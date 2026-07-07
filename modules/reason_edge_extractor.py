"""
Map a player's free-text indictment reason onto knowledge-graph edges.

The LLM is used only for natural-language understanding. The final win/loss
decision is made later by rule-based proof-graph scoring.
"""

import json

from modules.llm_client import llm


CONFIDENCE_THRESHOLD = 0.6
MAX_RETRIES = 3
DEBUG_EXTRACTION = True

_PROMPT = """\
You map a player's murder accusation explanation to knowledge-graph edge IDs.

Task:
- Read the player's explanation, which may be in Japanese or English.
- Rewrite it into atomic factual claims.
- Map each claim to the KG edges it meaningfully mentions or paraphrases.
- Do not judge whether the accusation wins.
- Do not solve the case.
- Return only valid JSON.

Use an edge when the player's meaning matches the edge, even if the wording is approximate,
translated, misspelled, or uses a natural description instead of exact names.
Use node names, Japanese display names, descriptions, significance, edge details, and relation
semantics to decide the mapping.

Relation guide:
- FOUND_IN: an item, person, or clue was found in a location.
- OWNS: ownership, belonging, initials, signature, personal property, or possession.
- CONNECTS_TO: a route, passage, shaft, door, corridor, or way between places.
- WAS_IN / PARTICIPATED_IN / OCCURRED_AT: a person or event was at a relevant place and time.
- CANNOT_ACCESS: a person could not enter or access a place.
- For other relations, use the natural meaning of the relation label and edge detail.

For each mapped edge, assign confidence from 0.0 to 1.0:
- 0.90-1.00: explicit or very close paraphrase.
- 0.70-0.89: clear implication from the player's wording.
- 0.50-0.69: plausible but incomplete/ambiguous mention.
- below 0.50: weak guess; include only if useful for debugging.

Return exactly this shape:
{{
  "claims": [
    {{
      "text": "A compact was found in the ventilation shaft.",
      "quote": "the player's phrase that supports this claim"
    }}
  ],
  "mentioned_edges": [
    {{
      "edge_id": "e1",
      "confidence": 0.92,
      "matched_claim": "A compact was found in the ventilation shaft.",
      "quote": "the player's phrase that supports this edge"
    }}
  ]
}}

[Knowledge graph edges]
{edge_text}

[Knowledge graph nodes and aliases]
{node_text}

[Player explanation]
{reason_text}
"""


def _extract_json(text: str) -> str:
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


def _node_label(node_id: str, nodes: dict) -> str:
    props = nodes.get(node_id, {}).get("properties", {})
    name = props.get("name", node_id)
    if "time" in props:
        return f"{name} @ {props['time']}"
    if "start_time" in props or "end_time" in props:
        start = props.get("start_time", "?")
        end = props.get("end_time", "?")
        return f"{name} @ {start} - {end}"
    return name


def _edge_to_line(edge: dict, nodes: dict) -> str:
    from_name = _node_label(edge["from"], nodes)
    to_name = _node_label(edge["to"], nodes)
    props = edge.get("properties", {})

    line = f'{edge["id"]}: {from_name} --[{edge["rel"]}]--> {to_name}'
    if "time" in props:
        line += f" @ {props['time']}"
    if "detail" in props:
        line += f' "{props["detail"]}"'
    return line


def _edge_text(edges: dict, nodes: dict) -> str:
    return "\n".join(_edge_to_line(edge, nodes) for edge in edges.values())


def _node_text(nodes: dict, display_names: dict = None) -> str:
    display_names = display_names or {}
    lines = []
    for node_id, node in nodes.items():
        props = node.get("properties", {})
        name = props.get("name", node_id)
        ja_name = display_names.get(name)
        parts = [f"{node_id}: {name}"]
        if ja_name:
            parts.append(f"Japanese: {ja_name}")
        if props.get("description"):
            parts.append(f'Description: {props["description"]}')
        if props.get("significance"):
            parts.append(f'Significance: {props["significance"]}')
        if props.get("time"):
            parts.append(f'Time: {props["time"]}')
        if props.get("start_time") or props.get("end_time"):
            parts.append(f'Time range: {props.get("start_time", "?")} - {props.get("end_time", "?")}')
        lines.append(" | ".join(parts))
    return "\n".join(lines)


def _clean_edge_ids(edge_ids: list, known_edge_ids: set) -> list:
    if not isinstance(edge_ids, list):
        return []
    cleaned = []
    for edge_id in edge_ids:
        if isinstance(edge_id, str) and edge_id in known_edge_ids and edge_id not in cleaned:
            cleaned.append(edge_id)
    return cleaned


def _coerce_confidence(value) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, confidence))


def _clean_edge_matches(matches, known_edge_ids: set, threshold: float) -> tuple[list, list]:
    if not isinstance(matches, list):
        return [], []

    edge_ids = []
    cleaned_matches = []
    for match in matches:
        if not isinstance(match, dict):
            continue

        edge_id = match.get("edge_id")
        if not isinstance(edge_id, str) or edge_id not in known_edge_ids:
            continue

        confidence = _coerce_confidence(match.get("confidence"))
        cleaned = {
            "edge_id": edge_id,
            "confidence": confidence,
            "matched_claim": str(match.get("matched_claim", "")),
            "quote": str(match.get("quote", "")),
        }
        if "reason" in match:
            cleaned["reason"] = str(match.get("reason", ""))
        cleaned_matches.append(cleaned)

        if confidence >= threshold and edge_id not in edge_ids:
            edge_ids.append(edge_id)

    return edge_ids, cleaned_matches


def _legacy_matches(edge_ids: list, known_edge_ids: set) -> list:
    return [
        {
            "edge_id": edge_id,
            "confidence": 1.0,
            "matched_claim": "",
            "quote": "",
        }
        for edge_id in _clean_edge_ids(edge_ids, known_edge_ids)
    ]


def _clean_claims(claims) -> list:
    if not isinstance(claims, list):
        return []
    cleaned = []
    for claim in claims:
        if isinstance(claim, dict):
            cleaned.append({
                "text": str(claim.get("text", "")),
                "quote": str(claim.get("quote", "")),
            })
        elif isinstance(claim, str):
            cleaned.append({"text": claim, "quote": ""})
    return cleaned


def extract_reason_edges(
    reason_text: str,
    nodes: dict,
    edges: dict,
    display_names: dict = None,
    confidence_threshold: float = CONFIDENCE_THRESHOLD,
) -> dict:
    base_prompt = _PROMPT.format(
        edge_text=_edge_text(edges, nodes),
        node_text=_node_text(nodes, display_names),
        reason_text=reason_text,
    )
    known_edge_ids = set(edges)
    threshold = _coerce_confidence(confidence_threshold)

    prompt = base_prompt
    raw = ""
    last_error = None

    for attempt in range(MAX_RETRIES):
        raw = llm(prompt, temperature=0.0)
        parsed, error = _parse_response(raw)

        if error is None:
            mentioned_matches = parsed.get("mentioned_edges")
            if mentioned_matches is None:
                mentioned_matches = _legacy_matches(parsed.get("mentioned_edge_ids", []), known_edge_ids)

            mentioned_edge_ids, mentioned_edges = _clean_edge_matches(
                mentioned_matches,
                known_edge_ids,
                threshold,
            )

            if DEBUG_EXTRACTION and attempt > 0:
                print(f"[ReasonExtractor] OK after {attempt + 1} attempts.")

            return {
                "mentioned_edge_ids": mentioned_edge_ids,
                "mentioned_edges": mentioned_edges,
                "claims": _clean_claims(parsed.get("claims")),
                "confidence_threshold": threshold,
                "raw": raw,
            }

        last_error = error
        if DEBUG_EXTRACTION:
            print(f"[ReasonExtractor] Attempt {attempt + 1} failed: {error}")
        prompt = (
            f"{base_prompt}\n\n"
            f"[Previous output was invalid: {error}. Return valid JSON only, matching the exact shape above.]"
        )

    if DEBUG_EXTRACTION:
        print(f"[ReasonExtractor] All {MAX_RETRIES} attempts failed. Last error: {last_error}")

    return {
        "mentioned_edge_ids": [],
        "mentioned_edges": [],
        "claims": [],
        "confidence_threshold": threshold,
        "raw": raw,
        "llm_error": last_error,
    }


def _parse_response(raw: str) -> tuple[dict, str | None]:
    cleaned = _extract_json(raw)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {}, f"edge extraction failed: {e}"
    if not isinstance(parsed, dict):
        return {}, "edge extraction did not return a JSON object"
    return parsed, None
