"""
This module is responsible for writing a narrative account for each suspect involved in a story plot.

Functions:
    get_narrative_header(plot, suspect_id: int) -> str:
        Constructs and returns the narrative header for a suspect's account.

    write_suspect_account(plot, suspect_id: int, accounts_path: str) -> None:
        Generates, writes a suspect's account to a file.
"""

from prompt_templates.generate_perspective import generate_perspective_template
from .assemble_suspect_context import assemble_suspect_context
from .llm_client import llm_messages

HISTORY_WINDOW = 2  # keep last N user/assistant pairs in context


def get_narrative_header(plot, suspect_id):
    suspect = plot.suspects[suspect_id]
    output_str = ""
    output_str += f"Suspect name: {suspect.name}\n"
    output_str += f"Suspect bio: {suspect.bio}\n"
    output_str += f"Suspect tags: {suspect.tags}\n"
    output_str += f"Suspect victim connection: {suspect.victim_connection}\n"
    output_str += f"Guilty?: {suspect.guilty}\n"
    output_str += f"Suspect ID: {suspect.id}\n"
    return output_str


def write_suspect_account(plot, suspect_id, accounts_path):
    """
    Generates, writes a suspect's account to a file.
    Uses per-thread conversation history — safe to call from multiple threads.
    """
    suspect_account_path = f"{accounts_path}/suspect_{suspect_id + 1}"

    with open(suspect_account_path, "w", encoding="utf-8") as f:
        suspect_context = assemble_suspect_context(plot, suspect_id)
        header = get_narrative_header(plot, suspect_id)
        f.write(header)
        f.write("\nTIMELINE:\n\n")

        # character_description is in the system prompt once — not repeated every turn
        system_content = generate_perspective_template.replace(
            "{info}", f"Case background:\n{suspect_context}"
        )
        system_msg = {"role": "system", "content": system_content}
        history = []  # list of user/assistant dicts (grows, then slides)

        for i, timestamp in enumerate(plot.timeline):
            action = timestamp.suspect_actions[suspect_id]
            time_and_action = f"At {timestamp.time}, {action}"

            suspect = plot.suspects[suspect_id]
            suspect.memory_path = suspect_account_path

            shared_interaction = plot.shared_interactions[i]
            if shared_interaction.interaction_content is not None:
                if suspect.name in (shared_interaction.suspect_a, shared_interaction.suspect_b):
                    time_and_action += " This is how the interaction went:"
                    time_and_action += f"\n\n{shared_interaction.interaction_content}"

            history.append({"role": "user", "content": time_and_action})

            # sliding window: system + last HISTORY_WINDOW exchanges
            window = history[-(HISTORY_WINDOW * 2):]
            entry = llm_messages([system_msg] + window, temperature=0.45)

            history.append({"role": "assistant", "content": entry})

            f.write(f"\n\nTIME: {timestamp.time}\n")
            f.write(entry)
