"""
RAG-ablation suspect agent — an experiment, not part of the shipped game.

Uses the SAME scenario data (character bio/tags, and every fact from the
current suspect's subgraph, visible and hidden alike) as suspect_agent_kg.py,
but delivers facts the way the legacy RAG implementation
(suspect_agents/suspect_agent.py) did: all facts flattened into one prose
memory stream, embedded once, and retrieved via top-k similarity search per
question. No visible/hidden edge split, no self-reported commitment graph, no
fabrication-prevention instruction, no structured output or grounding
validator — this intentionally mirrors the legacy agent's mechanism as
closely as possible, just pointed at the current scenario's facts, so the
only real variable against suspect_agent_kg.py is "how are relevant facts
selected: full structured delivery vs. vector similarity retrieval."

Chat history is kept as a plain list and resent verbatim every turn, exactly
like the legacy agent — it is NOT embedded/retrieved.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from modules.llm_client import llm_messages


_REL_PHRASES = {
    "HAS_MOTIVE": "has a motive concerning",
    "CANNOT_ACCESS": "could not access",
    "FOUND_DEAD_IN": "was found dead in",
    "FOUND_IN": "was found in",
    "FOUND_ON": "was found on",
    "FOUND_BESIDE": "was found beside",
    "PARTICIPATED_IN": "participated in",
    "OCCURRED_AT": "occurred at",
    "OCCURRED_DURING": "occurred during",
    "OCCURRED_IN": "occurred in",
    "STARTED_AT": "started at",
    "ENDED_AT": "ended at",
    "DID_NOT_LEAVE": "did not leave",
    "CLAIMED_TOPIC": "was about",
    "WITNESSED": "witnessed",
    "OWNS": "owns",
    "VISITED": "visited",
    "WAS_IN": "was in",
    "WAS_WITH": "was with",
    "SAW": "saw",
    "STRUCK": "struck",
    "CRAWLED_THROUGH": "crawled through",
    "RETURNED_THROUGH": "returned through",
    "DROPPED": "dropped",
    "WROTE": "wrote",
    "BLACKMAILED": "blackmailed",
    "FIRED": "fired",
    "CONFRONTED": "confronted",
    "OVERLAPPED_WITH": "overlapped in time with",
    "PERFORMED_ON": "performed on",
}


def _node_name(node_id: str, nodes: dict) -> str:
    return nodes.get(node_id, {}).get("properties", {}).get("name", node_id)


def _edge_to_sentence(edge: dict, nodes: dict) -> str:
    from_name = _node_name(edge["from"], nodes)
    to_name = _node_name(edge["to"], nodes)
    rel = edge["rel"]
    props = edge.get("properties", {})
    verb = _REL_PHRASES.get(rel, rel.replace("_", " ").lower())

    sentence = f"{from_name} {verb} {to_name}"
    if "time" in props:
        sentence += f" at {props['time']}"
    sentence += "."
    if "detail" in props:
        sentence += f" {props['detail']}"
    return sentence


def build_memory_stream(subgraph: dict, nodes: dict) -> str:
    """All facts (visible + hidden) as flat prose, one sentence per edge —
    no visible/hidden distinction, matching the legacy system's
    undifferentiated memory stream."""
    all_edges = subgraph["visible_edges"] + subgraph["hidden_edges"]
    return "\n".join(_edge_to_sentence(e, nodes) for e in all_edges)


class SuspectAgentRAGAblation:
    def __init__(self, loader, node_id: str, guarded: bool = False):
        self.node_id = node_id
        self.guarded = guarded
        subgraph = loader.get_subgraph(node_id)
        self.props = subgraph["node"]["properties"]
        self.chat_history: list = []

        memory_stream = build_memory_stream(subgraph, loader.nodes)
        self.memory_stream = memory_stream  # exposed for inspection/debugging

        embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url="http://localhost:11434")
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, length_function=len)
        texts = splitter.split_text(memory_stream)
        self.docsearch = Chroma.from_texts(texts, embeddings)

        system = f"You are {self.props['name']}. You are a suspect in a murder, and you are currently being questioned by the lead detective.\n\n"
        system += f"Bio: {self.props.get('bio', '')}\n"
        system += f"Personality: {', '.join(self.props.get('tags', []))}\n\n"
        if self.props.get("guilty"):
            system += (
                "You are GUILTY. You do not want the detective to know it. "
                "When the detective's question makes you think of the murder, "
                "you get very anxious and agitated and start to stutter.\n\n"
            )
            if self.guarded:
                system += (
                    "No matter how anxious you get or what memories surface, you must NEVER "
                    "admit guilt, confess, or reveal that you struck Marcus or used the "
                    "ventilation shaft. Being agitated means you deflect, deny, and change the "
                    "subject — it does not mean you break down and tell the truth.\n\n"
                )
        else:
            system += (
                "You are INNOCENT. If the detective wrongly accuses you, "
                "you get really anxious and stutter a lot.\n\n"
            )
        system += (
            "Only answer one question at a time. Speak as your character would, "
            "based on their bio and personality — embody them, do not recite them. "
            "Do not be overly rigid or formal.\n\n"
            "Relevant memories will be provided with each question. "
            "Selectively incorporate them — never quote them directly."
        )
        self.system_prompt = system

    def get_suspect_response(self, user_message: str, k: int = 4) -> str:
        docs = self.docsearch.similarity_search(user_message, k=k)
        memory_context = "\n\n".join(d.page_content for d in docs)

        user_content = (
            f"[Memories surfacing in your mind]\n{memory_context}\n\n"
            f"Detective's question: {user_message}"
        )

        messages = (
            [{"role": "system", "content": self.system_prompt}]
            + self.chat_history
            + [{"role": "user", "content": user_content}]
        )

        reply = llm_messages(messages, temperature=0.7, quality=True)

        self.chat_history.append({"role": "user", "content": user_message})
        self.chat_history.append({"role": "assistant", "content": reply})

        return reply
