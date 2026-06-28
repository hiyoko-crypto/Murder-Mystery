"""
Knowledge Graph data structures for HOLMES.

The god-KG contains all nodes and edges (including COMMITTED).
Each suspect receives a subgraph containing only what they would realistically know.

Visibility levels:
    public   — everyone sees it (crime scene, motives, found evidence)
    personal — only the named suspect sees it (own alibi, own items, own movements)
    god      — never distributed (COMMITTED edge)
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


class NodeType(Enum):
    PERSON = "PERSON"
    ITEM = "ITEM"
    LOCATION = "LOCATION"
    EVENT = "EVENT"


class EdgeType(Enum):
    # Public edges (shared with all suspects)
    HAS_MOTIVE = "HAS_MOTIVE"
    FOUND_IN = "FOUND_IN"
    FOUND_DEAD_IN = "FOUND_DEAD_IN"
    KILLED = "KILLED"
    WRITTEN_BY = "WRITTEN_BY"
    MENTIONS = "MENTIONS"
    HAS_ALIBI = "HAS_ALIBI"
    CONNECTS_TO = "CONNECTS_TO"

    # Personal edges (only the involved suspect sees it)
    WAS_AT = "WAS_AT"
    OWNED_BY = "OWNED_BY"
    INTERACTED_WITH = "INTERACTED_WITH"

    # God-only edge (never distributed)
    COMMITTED = "COMMITTED"


# Which edge types are always public
PUBLIC_EDGES = {
    EdgeType.HAS_MOTIVE,
    EdgeType.FOUND_IN,
    EdgeType.FOUND_DEAD_IN,
    EdgeType.KILLED,
    EdgeType.WRITTEN_BY,
    EdgeType.MENTIONS,
    EdgeType.HAS_ALIBI,
    EdgeType.CONNECTS_TO,
}


@dataclass
class Node:
    id: str           # unique slug, e.g. "elena_rostova"
    node_type: NodeType
    name: str         # display name, e.g. "Elena Rostova"
    properties: dict = field(default_factory=dict)  # bio, description, etc.

    def to_text(self) -> str:
        lines = [f"[{self.node_type.value}] {self.name}"]
        for k, v in self.properties.items():
            lines.append(f"  {k}: {v}")
        return "\n".join(lines)


@dataclass
class Edge:
    source_id: str
    edge_type: EdgeType
    target_id: str
    note: str = ""           # human-readable annotation, e.g. "Debt blackmail"
    owner_id: Optional[str] = None  # for personal edges: which suspect owns this edge

    def to_triple(self, nodes: dict) -> str:
        src = nodes[source_id].name if (source_id := self.source_id) in nodes else self.source_id
        tgt = nodes[target_id].name if (target_id := self.target_id) in nodes else self.target_id
        suffix = f" ({self.note})" if self.note else ""
        return f"[{src}] --({self.edge_type.value})--> [{tgt}]{suffix}"


class KnowledgeGraph:
    """
    Directed property graph for a murder mystery scenario.

    Usage:
        god_kg = KnowledgeGraph()
        god_kg.add_node(Node("elena", NodeType.PERSON, "Elena Rostova", {"bio": "..."}))
        god_kg.add_edge(Edge("elena", EdgeType.HAS_MOTIVE, "marcus", "Debt blackmail"))

        suspect_kg = god_kg.get_suspect_subgraph("Elena Rostova")
        print(suspect_kg.to_text())
    """

    def __init__(self):
        self.nodes: dict[str, Node] = {}
        self.edges: list[Edge] = []

    def add_node(self, node: Node) -> None:
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge) -> None:
        self.edges.append(edge)

    def get_node_by_name(self, name: str) -> Optional[Node]:
        for node in self.nodes.values():
            if node.name == name:
                return node
        return None

    def get_suspect_subgraph(self, suspect_name: str) -> "KnowledgeGraph":
        """
        Return a subgraph visible to the named suspect.
        Includes:
          - All public edges and their nodes
          - Personal edges owned by this suspect
        Excludes:
          - COMMITTED edges (always)
          - Personal edges owned by other suspects
        """
        suspect_node = self.get_node_by_name(suspect_name)
        suspect_id = suspect_node.id if suspect_node else None

        subgraph = KnowledgeGraph()
        included_ids: set[str] = set()

        for edge in self.edges:
            if edge.edge_type == EdgeType.COMMITTED:
                # Only the murderer knows they committed it
                if edge.source_id == suspect_id:
                    self._add_edge_to_subgraph(subgraph, edge, included_ids)
                continue
            if edge.edge_type in PUBLIC_EDGES:
                self._add_edge_to_subgraph(subgraph, edge, included_ids)
            elif edge.owner_id == suspect_id:
                self._add_edge_to_subgraph(subgraph, edge, included_ids)

        # Copy all referenced nodes into the subgraph
        for node_id in included_ids:
            if node_id in self.nodes:
                subgraph.nodes[node_id] = self.nodes[node_id]

        return subgraph

    def _add_edge_to_subgraph(self, subgraph: "KnowledgeGraph", edge: Edge, included_ids: set) -> None:
        subgraph.edges.append(edge)
        included_ids.add(edge.source_id)
        included_ids.add(edge.target_id)

    def to_text(self) -> str:
        """Format all edges as text triples (for LLM context)."""
        return "\n".join(edge.to_triple(self.nodes) for edge in self.edges)

    def to_node_summary(self) -> str:
        """Format all nodes with their properties."""
        return "\n\n".join(node.to_text() for node in self.nodes.values())

    def __getstate__(self) -> dict:
        return {"nodes": self.nodes, "edges": self.edges}

    def __setstate__(self, state: dict) -> None:
        self.nodes = state["nodes"]
        self.edges = state["edges"]
