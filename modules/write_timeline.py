"""
This module handles the timeline generation for the narrative. It defines functions to facilitate
the creation, parsing, and generation of timestamp data.
"""

import re
import json
from story_elements.timestamp import Timestamp
from LLM_functions.write_timestamp import write_timestamp_func
from modules.llm_client import llm


def _extract_json(text: str) -> dict | None:
    """Extract and parse a JSON object from LLM output using regex fallback."""
    if not text:
        return None
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        text = match.group()
    text = re.sub(r",\s*}", "}", text)
    text = re.sub(r",\s*\]", "]", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"JSON parse failed:\n{text[:300]}")
        return None


def parse_timeline(timestamps, plot):
    """
    Parses LLM-outputted JSON strings into Timestamp objects and adds them to the plot's timeline.
    Skips any entries that cannot be parsed.
    """
    for raw in timestamps:
        d = _extract_json(raw)
        if d is None:
            print("Warning: skipping unparseable timestamp")
            continue
        try:
            actions = [
                d["suspect_1_action"],
                d["suspect_2_action"],
                d["suspect_3_action"],
                d["suspect_4_action"],
            ]
        except KeyError as e:
            print(f"Warning: missing key {e} in timestamp, skipping")
            continue
        plot.add_timestamp_to_timeline(Timestamp(d["time"], actions))


def write_timeline_template(timestamp_number, background_info, shared_events, previous_timestamp, response_format):
    """Constructs the prompt template for a single timestamp."""
    timeline_base = ("You generate full timelines in 15 minute intervals. These timelines detail the actions and "
                     "experiences of each of the four suspects during the event.\n\n")

    timeline_base += f"You are currently writing timestamp {timestamp_number} out of 10.\n\n"
    timeline_base += "BACKGROUND INFO:\n\n"
    timeline_base += f"{background_info}\n\n"

    if shared_events.interaction_id is not None:
        shared_interaction = shared_events.get_interaction_pair()
        timeline_base += (f"THE FOLLOWING SUSPECTS MUST INTERACT AND ACKNOWLEDGE EACH-OTHER AT THIS TIMESTAMP "
                          f"({timestamp_number}/10). Their actions must contain each other's names:\n")
        timeline_base += f"{shared_interaction}\n\n"

    if previous_timestamp is not None:
        timeline_base += "PREVIOUS TIMESTAMP (Yours must be 15 minutes after this):\n"
        timeline_base += f"{previous_timestamp}\n\n"

    timeline_base += ("Fill in all the details, weaving a convincing, continuous narrative, otherwise you die.\n"
                      " ALL SUSPECTS (suspect 1, suspect 2, suspect 3, AND suspect 4) MUST HAVE AN ACTION AT EACH "
                      "TIMESTAMP.\n Detail how the murderer plots and carries out their crime; do not write about the "
                      "investigation.\n (ALL TIMES MUST BE IN FORMAT HH:MM AM/PM)\n\n")

    timeline_base += f"""TIMESTAMP {timestamp_number} OUT OF 10.
    Respond ONLY with a valid JSON object in this EXACT format:
    {{
    "time": "HH:MM AM/PM",
    "suspect_1_action": "What suspect 1 does at this time.",
    "suspect_2_action": "What suspect 2 does at this time.",
    "suspect_3_action": "What suspect 3 does at this time.",
    "suspect_4_action": "What suspect 4 does at this time."
    }}"""
    return timeline_base


def write_timeline(plot, response_format):
    """
    Generates the timeline sequentially, one timestamp at a time.
    No parallel LLM calls — avoids rate limit issues.
    """
    timestamps = []

    with open("timestamps.txt", "a", encoding="utf-8") as file:
        template = write_timeline_template(1, plot.get_summary(), plot.shared_interactions[0], None, response_format)
        template += "\n\nIMPORTANT: Output ONLY valid JSON."

        last_timestamp = llm(template)
        timestamps.append(last_timestamp)
        file.write(f"Prompt:\n{template}\nGenerated Timestamp:\n{last_timestamp}\n\n")
        print(last_timestamp)

        for i in range(2, 11):
            template = write_timeline_template(i, plot.get_summary(), plot.shared_interactions[i - 1],
                                               last_timestamp, response_format)
            last_timestamp = llm(template)
            timestamps.append(last_timestamp)
            file.write(f"Prompt:\n{template}\nGenerated Timestamp:\n{last_timestamp}\n\n")
            print(last_timestamp)

    parse_timeline(timestamps, plot)
