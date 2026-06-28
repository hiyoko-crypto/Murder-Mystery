"""Quick test: verify build_kg handles new alibi format and WAS_AT edges."""
from modules.build_kg import build_kg
from story_elements.knowledge_graph import EdgeType
from story_elements.plot import Plot
from story_elements.victim import Victim
from story_elements.murder_details import MurderDetails
from story_elements.suspect import Suspect

# --- Minimal dummy Plot ---
victim = Victim(name="Julian Blackwood", bio="Art collector")
murder = MurderDetails(
    murder_description="Stabbed in the study",
    murder_setting="the_study",
    murder_weapon="Letter Opener",
    murder_action="Alice stabbed Julian.",
)
suspects = [
    Suspect(id=1, name="Bob Innocent",   bio="...", tags=[], victim_connection="Friend",  guilty=False),
    Suspect(id=2, name="Carol Innocent", bio="...", tags=[], victim_connection="Rival",   guilty=False),
    Suspect(id=3, name="Dave Innocent",  bio="...", tags=[], victim_connection="Colleague",guilty=False),
    Suspect(id=4, name="Alice Guilty",   bio="...", tags=[], victim_connection="Enemy",   guilty=True),
]
plot = Plot(summary="Test mystery", victim=victim, murder_details=murder, suspects=suspects)

# --- Dummy raw JSON (new format) ---
raw_data = {
    "locations": [
        {"id": "the_study",   "name": "The Study",   "description": "Where the murder happened"},
        {"id": "the_garden",  "name": "The Garden",  "description": "Quiet outdoor area"},
        {"id": "the_library", "name": "The Library", "description": "Book-lined room"},
    ],
    "evidence": [
        {"id": "letter_opener", "name": "Letter Opener", "description": "Murder weapon",
         "found_in": "the_study", "owned_by": "Alice Guilty", "written_by": None},
        {"id": "diary",         "name": "Diary",          "description": "Victim's diary",
         "found_in": "the_library", "owned_by": None, "written_by": "Julian Blackwood"},
    ],
    "alibis": {
        "Bob Innocent":   {"description": "Was in the garden with a witness", "location_id": "the_garden"},
        "Carol Innocent": {"description": "Was reading in the library",       "location_id": "the_library"},
        "Dave Innocent":  {"description": "Was also in the garden",           "location_id": "the_garden"},
    },
}

kg = build_kg(plot, raw_data)

print("=== NODES ===")
for node in kg.nodes.values():
    print(f"  [{node.node_type.value}] {node.name}")

print("\n=== EDGES ===")
for e in kg.edges:
    src = kg.nodes[e.source_id].name if e.source_id in kg.nodes else e.source_id
    tgt = kg.nodes[e.target_id].name if e.target_id in kg.nodes else e.target_id
    print(f"  {src} --({e.edge_type.value})--> {tgt}")

print("\n=== ISOLATED NODES ===")
connected = set()
for e in kg.edges:
    connected.add(e.source_id)
    connected.add(e.target_id)
isolated = [n for n in kg.nodes.values() if n.id not in connected]
if isolated:
    for n in isolated:
        print(f"  ISOLATED: {n.name}")
else:
    print("  None - all nodes have edges!")

print("\n=== WAS_AT edges ===")
was_at = [e for e in kg.edges if e.edge_type == EdgeType.WAS_AT]
if was_at:
    for e in was_at:
        src = kg.nodes[e.source_id].name
        tgt = kg.nodes[e.target_id].name
        print(f"  {src} --(WAS_AT)--> {tgt}  [{e.note[:40]}]")
else:
    print("  None found — something is wrong!")
