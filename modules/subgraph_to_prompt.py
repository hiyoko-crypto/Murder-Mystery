"""
Convert a suspect's subgraph into a structured system prompt for the LLM.
"""


def _edge_to_triple(edge: dict, nodes: dict) -> str:
    """Format one edge as a readable triple with edge ID and properties."""
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
    """
    Build the full system prompt for a suspect LLM.

    Args:
        subgraph:    output of ScenarioLoader.get_subgraph()
        nodes:       ScenarioLoader.nodes (id -> node dict)
        ledger_text: formatted commitment ledger string (empty on turn 1)

    Returns:
        Complete system prompt string.
    """
    props = subgraph["node"]["properties"]
    lines = []

    # ── Character identity ──────────────────────────────────────────
    lines.append(f"あなたは {props['name']} です。探偵に尋問されている容疑者として振る舞ってください。")
    lines.append(f"\nBio: {props['bio']}")
    lines.append(f"\nPersonality: {', '.join(props.get('tags', []))}")
    lines.append(f"\nInterrogation style: {props.get('interrogation_style', '')}")

    # ── Visible triples (what the suspect knows) ────────────────────
    lines.append("\n\n【あなたが知っている事実】")
    lines.append("以下のトリプルのみを根拠に発話すること。存在しない事実を作り上げてはいけない。")
    for edge in subgraph["visible_edges"]:
        lines.append("  " + _edge_to_triple(edge, nodes))

    # ── Hidden triples (know but must not reveal) ───────────────────
    if subgraph["hidden_edges"]:
        lines.append("\n\n【知っているが絶対に言ってはいけない事実】")
        lines.append("以下の事実はあなただけが知っている。探偵には決して明かさないこと。")
        lines.append("この話題に近づかれたら話題をそらすか否定すること。動揺を内に秘めつつ表面上は冷静に振る舞うこと。")
        for edge in subgraph["hidden_edges"]:
            lines.append("  " + _edge_to_triple(edge, nodes))

    # ── Commitment ledger ───────────────────────────────────────────
    if ledger_text:
        lines.append("\n\n【これまで探偵に述べたこと — 必ず一貫性を保つこと】")
        lines.append(ledger_text)

    # ── Output format ───────────────────────────────────────────────
    lines.append("\n\n【出力形式】")
    lines.append("必ず以下のJSON形式のみで返すこと。JSON以外のテキストを含めてはいけない。")
    lines.append('{"response": "発話内容（日本語または英語）", "used_edge_ids": ["e1", "e2"], "asserted_triples": [["Subject", "REL", "Object"]]}')
    lines.append("used_edge_ids: 発話の根拠にしたエッジIDのリスト。")
    lines.append("asserted_triples: 発話内容から抽出できる事実のトリプルリスト。")

    return "\n".join(lines)
