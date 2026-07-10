from story_elements.pickle_plot import load_plot

plot = load_plot("saves/2026-06-02_20-38-37")
kg = plot.god_kg

print("=== NODES ===")
for node in kg.nodes.values():
    print(f"  [{node.node_type.value}] {node.id} -> {node.name}")

print("\n=== EDGES ===")
for e in kg.edges:
    src = kg.nodes[e.source_id].name if e.source_id in kg.nodes else e.source_id
    tgt = kg.nodes[e.target_id].name if e.target_id in kg.nodes else e.target_id
    note = (e.note[:50] + "...") if e.note and len(e.note) > 50 else (e.note or "")
    print(f"  {src} --({e.edge_type.value})--> {tgt}   [{note}]")

print("\n=== NODES WITH NO EDGES ===")
connected = set()
for e in kg.edges:
    connected.add(e.source_id)
    connected.add(e.target_id)
for node in kg.nodes.values():
    if node.id not in connected:
        print(f"  ISOLATED: [{node.node_type.value}] {node.name}")
