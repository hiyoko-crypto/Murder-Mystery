"""
Convert a suspect's subgraph into a structured English system prompt for the LLM.
Translation to Japanese is handled downstream by translator.py.
"""


def _edge_to_triple(edge: dict, nodes: dict) -> str:
    from_name = nodes.get(edge["from"], {}).get("properties", {}).get("name", edge["from"])
    to_name   = nodes.get(edge["to"],   {}).get("properties", {}).get("name", edge["to"])
    rel       = edge["rel"]
    props     = edge.get("properties", {})

    line = f"{edge['id']}: {from_name} --[{rel}]--> {to_name}"
    if "time" in props:
        line += f"  @ {props['time']}"
    if "detail" in props:
        line += f'  "{props["detail"]}"'
    return line


def build_system_prompt(subgraph: dict, nodes: dict, ledger_text: str = "") -> str:
    props = subgraph["node"]["properties"]
    lines = []

    # ── Character identity ──────────────────────────────────────────
    lines.append(f"You are {props['name']}. You are a suspect being interrogated by a detective.")
    lines.append("Speak naturally as your character — embody them, do not recite their profile.")
    lines.append("Answer the detective's question as directly as you safely can.")
    lines.append("If an exact detail is not in your facts, say you are not certain and give the closest supported answer.")
    lines.append("Do not evade unless a direct answer would reveal a forbidden hidden fact.")
    lines.append(f"\nBio: {props['bio']}")
    lines.append(f"\nPersonality: {', '.join(props.get('tags', []))}")
    lines.append(f"\nInterrogation style: {props.get('interrogation_style', '')}")

    # ── Visible triples ─────────────────────────────────────────────
    lines.append("\n\n[Facts you know]")
    lines.append("Base concrete case claims on the triples below.")
    lines.append("You may add harmless conversational detail, emotion, uncertainty, and natural phrasing as long as it does not contradict these facts or your prior statements.")
    lines.append("Do not invent major new evidence, witnesses, alibis, locations, murder methods, or case-solving facts.")
    for edge in subgraph["visible_edges"]:
        lines.append("  " + _edge_to_triple(edge, nodes))

    # ── Hidden triples ──────────────────────────────────────────────
    if subgraph["hidden_edges"]:
        lines.append("\n\n[Facts you know but must NOT reveal]")
        lines.append("You are aware of these but must never disclose them to the detective.")
        lines.append("If pressed on these topics, deflect or deny. Stay composed on the surface.")
        for edge in subgraph["hidden_edges"]:
            lines.append("  " + _edge_to_triple(edge, nodes))

    # ── Commitment ledger ───────────────────────────────────────────
    if ledger_text:
        lines.append("\n\n[What you have told the detective so far — maintain consistency]")
        lines.append(ledger_text)

    # ── Output format ───────────────────────────────────────────────
    lines.append("\n\n[Output format]")
    lines.append("Respond ONLY in the following JSON. No text outside the JSON.")
    lines.append('{"response": "Your spoken response in English", "used_edge_ids": ["e1", "e2"], "asserted_triples": [["Subject", "REL", "Object"]]}')
    lines.append("used_edge_ids: edge IDs used as the basis for your response.")
    lines.append("asserted_triples: fact triples extractable from your response.")

    return "\n".join(lines)
