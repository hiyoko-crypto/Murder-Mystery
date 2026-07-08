"""
Convert a suspect's subgraph into a structured English system prompt for the LLM.
Translation to Japanese is handled downstream by translator.py.
"""


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


def _edge_to_triple(edge: dict, nodes: dict) -> str:
    from_name = _node_label(edge["from"], nodes)
    to_name   = _node_label(edge["to"], nodes)
    rel       = edge["rel"]
    props     = edge.get("properties", {})

    line = f"{edge['id']}: {from_name} --[{rel}]--> {to_name}"
    if "provenance" in props:
        line += f"  ({props['provenance']})"
    if "time" in props:
        line += f"  @ {props['time']}"
    if "detail" in props:
        line += f'  "{props["detail"]}"'
    return line


def _group_visible_edges(edges: list) -> dict:
    groups = {
        "personal": [],
        "public": [],
        "other": [],
    }
    for edge in edges:
        provenance = edge.get("properties", {}).get("provenance", "")
        if provenance in {"self_knowledge", "direct_observation"}:
            groups["personal"].append(edge)
        elif provenance in {"public_report", "public_hearsay"}:
            groups["public"].append(edge)
        else:
            groups["other"].append(edge)
    return groups


def build_system_prompt(subgraph: dict, nodes: dict, ledger_text: str = "") -> str:
    props = subgraph["node"]["properties"]
    lines = []

    # ── Character identity ──────────────────────────────────────────
    lines.append(f"You are {props['name']}. You are a suspect being interrogated by a detective.")
    lines.append("Speak naturally as your character — embody them, do not recite their profile.")
    lines.append("Answer the detective's question as directly as you safely can.")
    lines.append("Use the facts as anchors. You may speak naturally and add harmless color, but do not add new concrete case facts such as people, places, times, evidence, or actions unless supported by your facts.")
    lines.append("Do not evade unless a direct answer would reveal a forbidden hidden fact.")
    lines.append(f"\nBio: {props['bio']}")
    lines.append(f"\nPersonality: {', '.join(props.get('tags', []))}")
    lines.append(f"\nInterrogation style: {props.get('interrogation_style', '')}")

    # ── Visible triples ─────────────────────────────────────────────
    groups = _group_visible_edges(subgraph["visible_edges"])
    lines.append("\n\n[Facts you know]")
    lines.append("Base concrete case claims on the triples below, respecting the provenance labels.")
    lines.append("You may add harmless conversational detail, emotion, uncertainty, and natural phrasing as long as it does not contradict these facts or your prior statements.")
    lines.append("Do not invent major new evidence, witnesses, claimed whereabouts, locations, murder methods, or case-solving facts.")
    if groups["personal"]:
        lines.append("\nPersonal knowledge / direct observations — you may speak about these as your own knowledge:")
    for edge in groups["personal"]:
        lines.append("  " + _edge_to_triple(edge, nodes))
    if groups["public"]:
        lines.append("\nPublic reports / hearsay — you may mention these, but do not present them as your own direct experience:")
    for edge in groups["public"]:
        lines.append("  " + _edge_to_triple(edge, nodes))
    if groups["other"]:
        lines.append("\nOther known facts — use cautiously and only as written:")
    for edge in groups["other"]:
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
        lines.append("\n\n[Your own prior statements this interrogation — maintain consistency]")
        lines.append("These are your own past claims, not verified case facts. Before answering, check them: do not give a new version of a location, timing, or opinion you already stated.")
        lines.append(ledger_text)

    # ── Output format ───────────────────────────────────────────────
    lines.append("\n\n[Output format]")
    lines.append("Respond ONLY in the following JSON. No text outside the JSON.")
    lines.append('{"response": "Your spoken response in English", "used_edge_ids": ["e1", "e2"], "asserted_triples": [["Subject", "REL", "Object"]]}')
    lines.append("used_edge_ids: edge IDs used as the basis for your response.")
    lines.append("asserted_triples: ONLY the fact triples explicitly stated in the \"response\" text above — not background facts you merely relied on without saying.")
    lines.append("Do not repeat a triple from your own prior statements below unless you are restating that exact fact again right now.")
    lines.append('If a triple has a specific time attached (from the facts above or your own response), append it to the object as "Object @ time", e.g. ["Elena", "VISITED", "Marcus\'s Dressing Room @ 7:00 PM"]. Omit the time if none applies — do not invent one.')

    return "\n".join(lines)
