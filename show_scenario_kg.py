"""
Render a scenario JSON knowledge_graph as an interactive HTML file.

Usage:
    python show_scenario_kg.py scenarios/the_final_act.json
    python show_scenario_kg.py scenarios/the_final_act.json -o plan/the_final_act_kg.html
    python show_scenario_kg.py scenarios/the_final_act.json --suspect n_julian
    python show_scenario_kg.py scenarios/the_final_act.json --open
"""

from __future__ import annotations

import argparse
import colorsys
import json
import os
import webbrowser
from html import escape
from pathlib import Path
from typing import Any

# Curated colors for the categories we care about visually distinguishing on sight.
# Anything not listed here (new event subtypes, one-off entity types, etc.) gets a
# stable color derived from its label name instead, so the ontology can keep growing
# without this dict needing to be hand-maintained.
NODE_COLORS = {
    "Victim": "#64748b",
    "Suspect": "#f0b35a",
    "Witness": "#0ea5e9",
    "WitnessGroup": "#0ea5e9",
    "Event": "#f59e0b",
    "CrimeEvent": "#dc2626",
    "PresenceEvent": "#16a34a",
    "Location": "#22c55e",
    "CrimeScene": "#8b5cf6",
    "EscapeRoute": "#10b981",
    "Item": "#ec4899",
    "Evidence": "#eab308",
    "MurderWeapon": "#c026d3",
    "Document": "#a8895a",
    "MotiveObject": "#ea580c",
    "Object": "#94a3b8",
    "Value": "#94a3b8",
}

EDGE_COLORS = {
    "self_knowledge": "#16a34a",
    "direct_observation": "#2563eb",
    "public_report": "#64748b",
    "public_hearsay": "#a16207",
    "discoverable_evidence": "#9333ea",
    "hidden": "#dc2626",
}

# Reading order used for the "category" filter buttons: place -> what happened -> who -> proof.
GROUP_LEVEL = {
    "CrimeScene": 0,
    "EscapeRoute": 0,
    "Location": 0,
    "CrimeEvent": 1,
    "PresenceEvent": 1,
    "Event": 1,
    "Victim": 2,
    "Suspect": 2,
    "Witness": 2,
    "WitnessGroup": 2,
    "Character": 2,
    "MurderWeapon": 3,
    "Evidence": 3,
    "Item": 3,
    "Document": 3,
    "MotiveObject": 3,
    "Object": 3,
    "Value": 3,
}
LEVEL_LABEL = {0: "場所", 1: "出来事", 2: "人物", 3: "証拠・物品"}

GROUP_SHAPE = {
    "CrimeScene": "diamond",
    "EscapeRoute": "diamond",
    "Location": "diamond",
    "CrimeEvent": "box",
    "PresenceEvent": "box",
    "Event": "box",
    "MurderWeapon": "star",
    "Evidence": "triangle",
    "Item": "triangle",
    "Document": "triangle",
    "MotiveObject": "triangle",
    "Object": "triangle",
    "Value": "triangle",
}
TIER_SHAPE = {0: "diamond", 1: "box", 2: "ellipse", 3: "triangle"}


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if "knowledge_graph" not in data:
        raise ValueError(f"{path} does not contain knowledge_graph")
    return data


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(c))):02x}" for c in rgb)


def _tint(hex_color: str, toward: tuple[int, int, int], amount: float) -> str:
    r, g, b = _hex_to_rgb(hex_color)
    tr, tg, tb = toward
    return _rgb_to_hex((r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount))


def _hash_color(label: str) -> str:
    h = 0
    for ch in label:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    hue = (h % 360) / 360.0
    r, g, b = colorsys.hls_to_rgb(hue, 0.45, 0.6)
    return _rgb_to_hex((r * 255, g * 255, b * 255))


def _node_group(labels: list[str]) -> str:
    """Most specific label (last in the list) — used as the stable per-node category key."""
    return labels[-1] if labels else "Other"


def _node_level(labels: list[str]) -> int:
    for label in labels:
        if label in GROUP_LEVEL:
            return GROUP_LEVEL[label]
    label_set = set(labels)
    if label_set & {"Character", "Witness", "WitnessGroup", "Victim", "Suspect"}:
        return 2
    if any(label == "Event" or label.endswith("Event") for label in labels):
        return 1
    if label_set & {"Location", "Place"}:
        return 0
    return 3


def _node_shape(labels: list[str]) -> str:
    for label in labels:
        if label in GROUP_SHAPE:
            return GROUP_SHAPE[label]
    return TIER_SHAPE[_node_level(labels)]


def _node_color(labels: list[str]) -> str:
    group = _node_group(labels)
    return NODE_COLORS.get(group, _hash_color(group))


def _node_style(labels: list[str]) -> dict[str, str]:
    border = _node_color(labels)
    return {
        "bg": _tint(border, (255, 255, 255), 0.82),
        "border": border,
        "font": _tint(border, (0, 0, 0), 0.55),
    }


def _edge_color(hidden: bool, provenance: str | None) -> str:
    if hidden:
        return EDGE_COLORS["hidden"]
    return EDGE_COLORS.get(provenance or "", "#94a3b8")


def _build_nodes(kg: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for node in kg.get("nodes", []):
        labels = node.get("labels", [])
        props = dict(node.get("properties", {}))
        name = props.pop("name", node["id"])
        style = _node_style(labels)
        result.append(
            {
                "id": node["id"],
                "name": name,
                "labels": labels,
                "group": _node_group(labels),
                "level": _node_level(labels),
                "shape": _node_shape(labels),
                "style": style,
                "properties": props,
            }
        )
    return result


def _build_edges(kg: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for edge in kg.get("edges", []):
        props = dict(edge.get("properties", {}))
        hidden = bool(props.pop("hidden_from_detective", False))
        known_by = props.pop("known_by", "all")
        provenance = props.pop("provenance", None)
        result.append(
            {
                "id": edge["id"],
                "from": edge["from"],
                "to": edge["to"],
                "rel": edge["rel"],
                "hidden": hidden,
                "knownBy": known_by,
                "provenance": provenance,
                "color": _edge_color(hidden, provenance),
                "properties": props,
            }
        )
    return result


def _js_json(value: Any) -> str:
    # Prevent a literal "</script>" inside embedded data from closing the tag early.
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def _build_html(
    title: str,
    node_list: list[dict[str, Any]],
    edge_list: list[dict[str, Any]],
    initial_suspect: str | None,
    initial_show_hidden: bool,
    initial_include_discoverable: bool,
) -> str:
    present_levels = sorted({n["level"] for n in node_list})
    level_buttons = "".join(
        f'<button class="btn" data-mode="level" data-value="{level}" onclick="selectFilter(this)">'
        f"{escape(LEVEL_LABEL.get(level, f'Level {level}'))}のみ</button>"
        for level in present_levels
    )
    suspects = [n for n in node_list if "Suspect" in n["labels"]]
    suspect_buttons = "".join(
        f'<button class="btn" data-mode="suspect" data-value="{escape(s["id"], quote=True)}" onclick="selectFilter(this)">'
        f"{escape(s['name'])} の知識</button>"
        for s in suspects
    )
    legend_items = "".join(
        f'<div class="legend-item"><span class="legend-dot" style="background:{color}"></span>{escape(label)}</div>'
        for label, color in EDGE_COLORS.items()
    )

    initial_mode = "suspect" if initial_suspect else "all"
    initial_value = initial_suspect or ""

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>{escape(title)} — Knowledge Graph</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ height: 100%; }}
  body {{
    display: flex;
    flex-direction: column;
    background: #f8fafc;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  }}

  #header {{
    padding: 16px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }}
  #header h1 {{ font-size: 1.05rem; color: #0f172a; font-weight: 700; }}
  #header p {{ font-size: 0.78rem; color: #64748b; margin-top: 2px; }}

  .legend {{ display: flex; gap: 14px; flex-wrap: wrap; margin-left: auto; }}
  .legend-item {{ display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #64748b; }}
  .legend-dot {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}

  #controls {{
    padding: 10px 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
  }}
  .btn {{
    padding: 5px 14px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #f1f5f9;
    color: #475569;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }}
  .btn:hover {{ background: #e2e8f0; color: #1e293b; }}
  .btn.active {{ background: #dbeafe; color: #1d4ed8; border-color: #3b82f6; }}
  .toggles {{ display: flex; align-items: center; gap: 14px; margin-left: auto; }}
  .toggle {{ display: flex; align-items: center; gap: 5px; font-size: 0.76rem; color: #475569; cursor: pointer; }}
  #stat {{ font-size: 0.72rem; color: #94a3b8; }}

  #main {{ flex: 1; min-height: 0; display: flex; }}
  #network {{ flex: 1; background: #ffffff; }}

  #sidebar {{
    width: 320px;
    flex-shrink: 0;
    background: #ffffff;
    border-left: 1px solid #e2e8f0;
    padding: 20px;
    overflow-y: auto;
    font-size: 0.82rem;
  }}
  #sidebar h2 {{ font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }}
  #sidebar .empty {{ color: #cbd5e1; font-style: italic; }}

  .nd-label {{ font-size: 1.05rem; font-weight: 700; color: #0f172a; margin-bottom: 4px; }}
  .nd-type {{ font-size: 0.72rem; color: #94a3b8; margin-bottom: 14px; }}
  .nd-section {{ margin-bottom: 14px; }}
  .nd-section-title {{ font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }}
  .nd-prop {{ color: #334155; line-height: 1.6; }}
  .nd-prop strong {{ color: #0f172a; }}
  .nd-edge {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 7px 10px;
    margin-bottom: 6px;
    font-size: 0.78rem;
  }}
  .nd-edge .eid {{ font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #94a3b8; font-size: 0.68rem; margin-right: 4px; }}
  .nd-edge .rel {{ color: #b45309; font-weight: 600; font-size: 0.7rem; }}
  .nd-edge .node {{ color: #1d4ed8; font-weight: 500; }}
  .nd-edge .meta {{ color: #94a3b8; font-size: 0.7rem; margin-top: 2px; }}
  .nd-edge .hidden-flag {{ color: #dc2626; font-size: 0.7rem; margin-top: 2px; font-weight: 600; }}
  .tag {{
    display: inline-block;
    padding: 1px 7px;
    border-radius: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    margin-left: 6px;
  }}
  .tag-guilty {{ background: #fee2e2; color: #b91c1c; }}
  .tag-innocent {{ background: #dcfce7; color: #15803d; }}
</style>
</head>
<body>

<div id="header">
  <div>
    <h1>{escape(title)} — Knowledge Graph</h1>
    <p>ノードをクリックすると詳細を表示 / ドラッグで移動 / スクロールでズーム</p>
  </div>
  <div class="legend">{legend_items}</div>
</div>

<div id="controls">
  <button class="btn active" data-mode="all" data-value="" onclick="selectFilter(this)">全て表示</button>
  {level_buttons}
  {suspect_buttons}
  <div class="toggles">
    <label class="toggle"><input type="checkbox" id="toggle-hidden" {"checked" if initial_show_hidden else ""} onchange="render()">隠蔽エッジを表示</label>
    <label class="toggle"><input type="checkbox" id="toggle-discoverable" {"checked" if initial_include_discoverable else ""} onchange="render()">発見可能な証拠を含める</label>
    <span id="stat"></span>
  </div>
</div>

<div id="main">
  <div id="network"></div>
  <div id="sidebar">
    <h2>詳細</h2>
    <p class="empty">ノードをクリックしてください</p>
  </div>
</div>

<script>
const KG_NODES = {_js_json(node_list)};
const KG_EDGES = {_js_json(edge_list)};

const nodeById = {{}};
KG_NODES.forEach(n => nodeById[n.id] = n);

let allNodes = KG_NODES.map(n => ({{
  id: n.id,
  label: n.name,
  shape: n.shape,
  color: {{
    background: n.style.bg,
    border: n.style.border,
    highlight: {{ background: n.style.bg, border: n.style.border }},
  }},
  font: {{ color: n.style.font, size: 13 }},
  borderWidth: 2,
  margin: 8,
}}));

let allEdges = KG_EDGES.map(e => ({{
  id: e.id,
  from: e.from,
  to: e.to,
  label: e.id + ": " + e.rel,
  color: {{ color: e.color, highlight: "#0f172a" }},
  font: {{ color: e.color, size: 10, strokeWidth: 4, strokeColor: "#ffffff", align: "middle" }},
  arrows: {{ to: {{ enabled: true, scaleFactor: 0.6 }} }},
  dashes: e.hidden,
  width: e.hidden ? 2.5 : 1.4,
  smooth: {{ type: "curvedCW", roundness: 0.15 }},
}}));

const nodes = new vis.DataSet(allNodes);
const edges = new vis.DataSet(allEdges);

const container = document.getElementById("network");
const network = new vis.Network(container, {{ nodes, edges }}, {{
  physics: {{
    solver: "forceAtlas2Based",
    forceAtlas2Based: {{ gravitationalConstant: -80, centralGravity: 0.006, springLength: 150, springConstant: 0.05, damping: 0.35 }},
    stabilization: {{ iterations: 250 }},
  }},
  interaction: {{ hover: true, tooltipDelay: 100 }},
  layout: {{ improvedLayout: true }},
}});
network.once("stabilizationIterationsDone", function() {{
  network.setOptions({{ physics: {{ enabled: false }} }});
}});

// ===== FILTERING =====
let currentFilter = {{ mode: {_js_json(initial_mode)}, value: {_js_json(initial_value)} }};

function knownByMatches(knownBy, suspectId) {{
  if (knownBy === "all") return true;
  if (Array.isArray(knownBy)) return knownBy.includes(suspectId);
  return knownBy === suspectId;
}}

function render() {{
  const showHidden = document.getElementById("toggle-hidden").checked;
  const includeDiscoverable = document.getElementById("toggle-discoverable").checked;

  let visibleEdgeIds;
  if (currentFilter.mode === "suspect") {{
    visibleEdgeIds = new Set(KG_EDGES.filter(e => {{
      if (e.hidden && !showHidden) return false;
      const known = knownByMatches(e.knownBy, currentFilter.value);
      const discoverable = includeDiscoverable && e.provenance === "discoverable_evidence";
      return known || discoverable;
    }}).map(e => e.id));
  }} else {{
    visibleEdgeIds = new Set(KG_EDGES.filter(e => showHidden || !e.hidden).map(e => e.id));
  }}

  let visibleNodeIds;
  if (currentFilter.mode === "level") {{
    visibleNodeIds = new Set(KG_NODES.filter(n => n.level === currentFilter.value).map(n => n.id));
    visibleEdgeIds = new Set([...visibleEdgeIds].filter(id => {{
      const e = KG_EDGES.find(x => x.id === id);
      return visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to);
    }}));
  }} else if (currentFilter.mode === "suspect") {{
    visibleNodeIds = new Set([currentFilter.value]);
    KG_EDGES.forEach(e => {{
      if (visibleEdgeIds.has(e.id)) {{ visibleNodeIds.add(e.from); visibleNodeIds.add(e.to); }}
    }});
  }} else {{
    visibleNodeIds = new Set(KG_NODES.map(n => n.id));
  }}

  nodes.update(KG_NODES.map(n => ({{ id: n.id, hidden: !visibleNodeIds.has(n.id) }})));
  edges.update(KG_EDGES.map(e => ({{ id: e.id, hidden: !visibleEdgeIds.has(e.id) }})));
  document.getElementById("stat").textContent = `${{visibleNodeIds.size}} nodes / ${{visibleEdgeIds.size}} edges`;
}}

function selectFilter(btn) {{
  document.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const level = btn.dataset.mode === "level" ? Number(btn.dataset.value) : btn.dataset.value;
  currentFilter = {{ mode: btn.dataset.mode, value: level }};
  render();
}}

// ===== SIDEBAR =====
function fmtValue(v) {{
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}}

network.on("click", function(params) {{
  if (params.nodes.length === 0) return;
  const n = nodeById[params.nodes[0]];
  const sidebar = document.getElementById("sidebar");

  const guiltyBadge = "guilty" in n.properties
    ? (n.properties.guilty
        ? '<span class="tag tag-guilty">犯人</span>'
        : '<span class="tag tag-innocent">無実</span>')
    : "";

  const desc = n.properties.bio || n.properties.description || "";
  const skipKeys = new Set(["bio", "description", "guilty"]);
  const propLines = Object.entries(n.properties)
    .filter(([k]) => !skipKeys.has(k))
    .map(([k, v]) => '<div class="nd-prop"><strong>' + k + ':</strong> ' + fmtValue(v) + '</div>')
    .join("");

  const connected = KG_EDGES.filter(e => e.from === n.id || e.to === n.id);
  const edgeHTML = connected.map(e => {{
    const outgoing = e.from === n.id;
    const other = nodeById[outgoing ? e.to : e.from];
    const arrow = outgoing ? "&rarr;" : "&larr;";
    const metaBits = [];
    if (e.properties.time) metaBits.push(e.properties.time);
    if (e.provenance) metaBits.push(e.provenance);
    const metaStr = metaBits.length ? `<div class="meta">${{metaBits.join(" / ")}}</div>` : "";
    const hiddenStr = e.hidden ? '<div class="hidden-flag">🔴 探偵には隠蔽</div>' : "";
    const extra = Object.entries(e.properties)
      .filter(([k]) => k !== "time")
      .map(([k, v]) => `<div class="meta">${{k}}: ${{fmtValue(v)}}</div>`)
      .join("");
    return `<div class="nd-edge"><span class="eid">${{e.id}}</span> <span class="rel">${{e.rel}}</span> ${{arrow}} <span class="node">${{other ? other.name : (outgoing ? e.to : e.from)}}</span>${{metaStr}}${{extra}}${{hiddenStr}}</div>`;
  }}).join("");

  sidebar.innerHTML = `
    <h2>詳細</h2>
    <div class="nd-label">${{n.name}}</div>
    <div class="nd-type">${{n.labels.join(", ")}}${{guiltyBadge}}</div>
    <div class="nd-section">
      <div class="nd-section-title">説明</div>
      <div class="nd-prop">${{desc || "(説明なし)"}}</div>
    </div>
    ${{propLines ? `<div class="nd-section"><div class="nd-section-title">プロパティ</div>${{propLines}}</div>` : ""}}
    <div class="nd-section">
      <div class="nd-section-title">関連エッジ（${{connected.length}}件）</div>
      ${{edgeHTML || '<div class="nd-prop" style="color:#cbd5e1">なし</div>'}}
    </div>
  `;
}});

render();
</script>
</body>
</html>
"""


def render_scenario_kg(
    scenario_path: Path,
    output_path: Path,
    suspect_id: str | None = None,
    include_hidden: bool = False,
    include_discoverable: bool = False,
) -> None:
    data = _load_json(scenario_path)
    kg = data["knowledge_graph"]
    title = data.get("title") or data.get("scenario_id") or scenario_path.stem

    node_list = _build_nodes(kg)
    edge_list = _build_edges(kg)

    html = _build_html(
        title=title,
        node_list=node_list,
        edge_list=edge_list,
        initial_suspect=suspect_id,
        initial_show_hidden=include_hidden,
        initial_include_discoverable=include_discoverable,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")


def _default_output_path(scenario_path: Path, suspect_id: str | None) -> Path:
    suffix = f"_{suspect_id}" if suspect_id else ""
    return Path("plan") / f"{scenario_path.stem}{suffix}_kg.html"


def main() -> None:
    parser = argparse.ArgumentParser(description="Render scenario knowledge_graph JSON to HTML.")
    parser.add_argument("scenario", type=Path, help="Path to scenario JSON.")
    parser.add_argument("-o", "--output", type=Path, help="Output HTML path. Defaults to plan/<scenario>_kg.html.")
    parser.add_argument("--suspect", help="Start the page filtered to a suspect's knowledge, e.g. n_julian.")
    parser.add_argument("--include-hidden", action="store_true", help="Show hidden_from_detective edges by default.")
    parser.add_argument(
        "--include-discoverable",
        action="store_true",
        help="For the suspect view, also include discoverable_evidence edges by default.",
    )
    parser.add_argument("--open", action="store_true", help="Open generated HTML in the default browser.")
    args = parser.parse_args()

    output = args.output or _default_output_path(args.scenario, args.suspect)
    render_scenario_kg(
        scenario_path=args.scenario,
        output_path=output,
        suspect_id=args.suspect,
        include_hidden=args.include_hidden,
        include_discoverable=args.include_discoverable,
    )
    print(f"Saved: {output}")

    if args.open:
        webbrowser.open(os.path.abspath(output))


if __name__ == "__main__":
    main()
