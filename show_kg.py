"""
Loads a saved plot.pkl and visualizes the god-KG as an interactive HTML file.

Usage:
    py show_kg.py                         # most recent save with plot.pkl
    py show_kg.py saves/2026-05-25_17-14-13
"""

import os
import sys
import glob
import webbrowser
from pyvis.network import Network
from story_elements.pickle_plot import load_plot
from story_elements.knowledge_graph import KnowledgeGraph, EdgeType

NODE_COLORS = {
    "PERSON":   "#4e9af1",
    "ITEM":     "#f1c84e",
    "LOCATION": "#6dcf7f",
    "EVENT":    "#cf6d6d",
}

EDGE_COLORS = {
    EdgeType.COMMITTED:       "#e74c3c",
    EdgeType.HAS_MOTIVE:      "#e67e22",
    EdgeType.KILLED:          "#c0392b",
    EdgeType.FOUND_DEAD_IN:   "#8e44ad",
    EdgeType.FOUND_IN:        "#3498db",
    EdgeType.OWNED_BY:        "#2ecc71",
    EdgeType.WRITTEN_BY:      "#1abc9c",
    EdgeType.HAS_ALIBI:       "#27ae60",
    EdgeType.WAS_AT:          "#95a5a6",
    EdgeType.INTERACTED_WITH: "#f39c12",
    EdgeType.MENTIONS:        "#bdc3c7",
    EdgeType.CONNECTS_TO:     "#7f8c8d",
}

LEGEND_HTML = """
<div style="
    position: fixed; top: 12px; right: 12px; z-index: 999;
    background: rgba(255,255,255,0.93); border: 1px solid #ccc;
    border-radius: 8px; padding: 12px 16px; font-family: sans-serif; font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); min-width: 200px;
">
  <b>Node types</b><br>
  <span style="color:#4e9af1">&#9646;</span> PERSON &nbsp;
  <span style="color:#f1c84e">&#9646;</span> ITEM &nbsp;
  <span style="color:#6dcf7f">&#9646;</span> LOCATION &nbsp;
  <span style="color:#cf6d6d">&#9646;</span> EVENT
  <hr style="margin:6px 0">
  <b>Edge types</b><br>
  <span style="color:#e74c3c">&#9472;</span> COMMITTED<br>
  <span style="color:#e67e22">&#9472;</span> HAS_MOTIVE<br>
  <span style="color:#c0392b">&#9472;</span> KILLED<br>
  <span style="color:#8e44ad">&#9472;</span> FOUND_DEAD_IN<br>
  <span style="color:#3498db">&#9472;</span> FOUND_IN<br>
  <span style="color:#2ecc71">&#9472;</span> OWNED_BY<br>
  <span style="color:#1abc9c">&#9472;</span> WRITTEN_BY<br>
  <span style="color:#27ae60">&#9472;</span> HAS_ALIBI<br>
  <span style="color:#95a5a6">&#9472;</span> WAS_AT<br>
  <span style="color:#f39c12">&#9472;</span> INTERACTED_WITH<br>
  <span style="color:#7f8c8d">&#9472;</span> CONNECTS_TO
  <hr style="margin:6px 0">
  <span style="font-size:11px; color:#888">Hover edges for details</span>
</div>
"""

STOP_PHYSICS_JS = """
<script>
  network.once("stabilizationIterationsDone", function() {
    network.setOptions({ physics: { enabled: false } });
  });
</script>
"""

PHYSICS_OPTIONS = """{
  "physics": {
    "enabled": true,
    "solver": "barnesHut",
    "barnesHut": {
      "gravitationalConstant": -3000,
      "centralGravity": 0.6,
      "springLength": 100,
      "springConstant": 0.08,
      "damping": 0.15,
      "avoidOverlap": 0.8
    },
    "stabilization": {
      "enabled": true,
      "iterations": 300,
      "updateInterval": 25
    }
  },
  "edges": {
    "arrows": {"to": {"enabled": true, "scaleFactor": 0.7}},
    "font": {"size": 10},
    "smooth": {"type": "dynamic"}
  },
  "nodes": {
    "font": {"size": 14},
    "margin": 8
  },
  "interaction": {
    "hover": true,
    "tooltipDelay": 100
  }
}"""


def _find_latest_save():
    saves = sorted(glob.glob("saves/*/plot.pkl"))
    if not saves:
        raise FileNotFoundError("No saves with plot.pkl found.")
    return os.path.dirname(saves[-1])


def _write_html(net: Network, path: str) -> None:
    html = net.generate_html()
    html = html.replace("</body>", LEGEND_HTML + STOP_PHYSICS_JS + "\n</body>")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def _kg_to_pyvis(kg: KnowledgeGraph, title: str) -> Network:
    net = Network(height="820px", width="100%", directed=True, notebook=False)
    net.set_options(PHYSICS_OPTIONS)
    net.heading = title

    for node in kg.nodes.values():
        color = NODE_COLORS.get(node.node_type.value, "#aaaaaa")
        lines = [f"[{node.node_type.value}] {node.name}"]
        for k, v in node.properties.items():
            if v and k != "tags":
                lines.append(f"{k}: {v}")
        net.add_node(
            node.id,
            label=node.name,
            color={"background": color, "border": "#555",
                   "highlight": {"background": color, "border": "#222"}},
            title="<br>".join(lines),
            shape="ellipse",
            size=22,
        )

    for edge in kg.edges:
        if edge.source_id not in kg.nodes or edge.target_id not in kg.nodes:
            continue
        color = EDGE_COLORS.get(edge.edge_type, "#999999")
        label = edge.edge_type.value
        tooltip = f"<b>{label}</b>" + (f"<br>{edge.note}" if edge.note else "")
        net.add_edge(
            edge.source_id,
            edge.target_id,
            label=label,
            title=tooltip,
            color={"color": color, "highlight": color, "opacity": 0.85},
            font={"size": 10, "color": "#333333", "background": "#ffffff", "strokeWidth": 0},
            width=2,
        )

    return net


def show_kg(save_path: str):
    print(f"Loading: {save_path}/plot.pkl")
    plot = load_plot(save_path)

    if plot.god_kg is None:
        print("This save has no KG. Re-run generate_story.py.")
        return

    kg = plot.god_kg
    title = f"God-KG  |  {len(kg.nodes)} nodes  {len(kg.edges)} edges"
    net = _kg_to_pyvis(kg, title)

    out_path = os.path.join(save_path, "kg_god.html")
    _write_html(net, out_path)
    print(f"Saved: {out_path}")

    webbrowser.open(os.path.abspath(out_path))
    print("Opened in browser.")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else _find_latest_save()
    show_kg(path)
