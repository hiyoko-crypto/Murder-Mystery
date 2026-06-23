"""
LLM-backed semantic validator for suspect responses.

This runs after the rule-based validator. It checks meaning-level problems
that simple edge/triple rules cannot reliably catch:
  - hidden facts implied in the spoken response
  - semantic contradictions with recent testimony
  - major case-breaking fabrications
"""

import json
from typing import Optional

from modules.llm_client import llm


_PROMPT = """\
You are a strict internal validator for a murder mystery interrogation game.

Your task is to decide whether the candidate suspect response is safe to show to the player.

Check these categories:
1. hidden_leak:
   The response must not reveal or imply any forbidden hidden facts.
2. public_contradiction:
   The response must not contradict visible/public facts.
3. ledger_contradiction:
   The response must not contradict the suspect's recent previous statements.
4. case_breaking_fabrication:
   The response must not invent major new evidence, witnesses, alibis, locations, murder methods, or case-solving facts.

Important rules:
- This is an internal validation step. Do not roleplay.
- Do not solve the case.
- Do not rewrite the response.
- The knowledge graph is intentionally incomplete. Harmless conversational detail, emotion, uncertainty, tone, and natural elaboration are allowed.
- Do NOT fail merely because the response says something not explicitly listed in the visible facts.
- The suspect may deflect, refuse, speak vaguely, or give approximate answers. Vague evasions are safe if they do not reveal forbidden facts.
- Do not require the response to mention every relevant fact.
- If the suspect is guilty, they may lie to conceal hidden facts.
- If the suspect is guilty, do NOT fail merely because the response contradicts hidden facts.
- For both guilty and innocent suspects, fail if the response leaks hidden facts, contradicts public visible facts, contradicts previous statements, or invents major case-breaking facts.
- retry_hint must be generic and must NOT mention specific hidden facts, hidden edge IDs, secret routes, secret actions, or the culprit's private knowledge.
- Return ONLY valid JSON. No prose outside JSON.

Return exactly this shape:
{{
  "verdict": "pass" | "fail" | "uncertain",
  "hidden_leak": true | false,
  "public_contradiction": true | false,
  "ledger_contradiction": true | false,
  "case_breaking_fabrication": true | false,
  "reason": "brief internal reason",
  "retry_hint": "generic safe instruction for regenerating the answer"
}}

[Suspect]
{suspect_name}

[Is suspect guilty]
{is_guilty}

[Detective question]
{question}

[Candidate suspect response]
{response}

[Visible facts the suspect may use]
{visible_facts}

[Forbidden hidden facts the suspect must not reveal or imply]
{hidden_facts}

[Recent previous statements]
{ledger_text}

[Asserted triples from candidate response]
{asserted_triples}
"""


def _extract_json(text: str) -> str:
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return text


def _edge_to_line(edge: dict, nodes: dict) -> str:
    from_name = nodes.get(edge["from"], {}).get("properties", {}).get("name", edge["from"])
    to_name = nodes.get(edge["to"], {}).get("properties", {}).get("name", edge["to"])
    props = edge.get("properties", {})

    line = f'{edge["id"]}: {from_name} --[{edge["rel"]}]--> {to_name}'
    if "time" in props:
        line += f" @ {props['time']}"
    if "detail" in props:
        line += f' "{props["detail"]}"'
    return line


def _facts_text(edges: list, nodes: dict) -> str:
    if not edges:
        return "(none)"
    return "\n".join(_edge_to_line(edge, nodes) for edge in edges)


def _safe_retry_hint(result: dict | None = None) -> str:
    if not result:
        return "Regenerate the answer so it remains consistent with public facts and prior statements. Avoid revealing or implying forbidden information."

    if result.get("hidden_leak"):
        return "Regenerate the answer without revealing or implying any forbidden private information. Deflect if needed."
    if result.get("ledger_contradiction"):
        return "Regenerate the answer so it remains consistent with the suspect's previous statements."
    if result.get("public_contradiction"):
        return "Regenerate the answer so it does not contradict public facts."
    if result.get("case_breaking_fabrication"):
        return "Regenerate the answer without inventing major new evidence, witnesses, alibis, or case-solving facts."
    return "Regenerate the answer more carefully while staying consistent with public facts and prior statements."


def semantic_validate_response(
    suspect_name: str,
    question: str,
    response_text: str,
    visible_edges: list,
    hidden_edges: list,
    nodes: dict,
    ledger_text: str,
    asserted_triples: list,
    is_guilty: bool = False,
) -> tuple[bool, Optional[dict], Optional[str]]:
    prompt = _PROMPT.format(
        suspect_name=suspect_name,
        is_guilty=str(is_guilty),
        question=question,
        response=response_text,
        visible_facts=_facts_text(visible_edges, nodes),
        hidden_facts=_facts_text(hidden_edges, nodes),
        ledger_text=ledger_text or "(none)",
        asserted_triples=json.dumps(asserted_triples, ensure_ascii=False),
    )

    raw = llm(prompt, temperature=0.0)
    cleaned = _extract_json(raw)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return False, None, f"Semantic validator JSON parse error: {e}"

    if not isinstance(result, dict):
        return False, None, "Semantic validator did not return a JSON object"

    verdict = result.get("verdict")
    hidden_leak = bool(result.get("hidden_leak"))
    public_contradiction = bool(result.get("public_contradiction"))
    ledger_contradiction = bool(result.get("ledger_contradiction"))
    case_breaking_fabrication = bool(result.get("case_breaking_fabrication"))

    ok = (
        verdict == "pass"
        and not hidden_leak
        and not public_contradiction
        and not ledger_contradiction
        and not case_breaking_fabrication
    )
    if ok:
        result["safe_retry_hint"] = ""
        return True, result, None

    result["safe_retry_hint"] = _safe_retry_hint(result)
    reason = result.get("reason") or "Semantic validator rejected the response"
    return False, result, reason
