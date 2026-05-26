"""
This module handles story initialization. It includes functions for generating a base story
schema, parsing it, saving necessary information to disk, and spawning threads to write suspect accounts.

Functions:
    fix_trailing_commas(json_string: str) -> dict:
        Fixes trailing commas in JSON strings and returns a JSON object.

    save_schema(plot, save_path: str) -> None:
        Saves the plot and suspect schema to a file.

    save_timeline(timeline, save_path: str) -> None:
        Saves the timeline of events to a file.

    save_shared_events(shared_events, save_path: str) -> None:
        Saves shared events to a JSON file.

    save_shared_interactions(plot, save_path: str) -> None:
        Saves shared interactions to a file.

    initialize_story(save_path: str):
        Initializes the story by generating a base story schema, parsing it,
        saving necessary information to disk, and spawning threads to write suspect accounts.
"""

import os
import re
import json
import threading
from .llm_client import llm

# Importing necessary functions and templates from other modules
from LLM_functions.set_up_story import set_up_story_func
from LLM_functions.shared_events import shared_events_func
from LLM_functions.write_timestamp import write_timestamp_func
from .shared_convo_gen import generate_shared_interactions
from .parse_shared_events import parse_shared_interactions
from .suspect_init import write_suspect_account
from .write_timeline import write_timeline
from .parse_story import parse_story
from prompt_templates.story_init import author_template
from prompt_templates.shared_events import shared_events_template


def fix_trailing_commas(json_string: str) -> dict:
    """
    Corrects the trailing commas in a JSON string to ensure it is a valid JSON object.
    Invalid commas are usually found at the end of collections such as lists and dictionaries.

    Args:
        json_string (str): The JSON string to be corrected.

    Returns:
        dict: A valid JSON object after correcting the trailing commas.
    """

    if not json_string:
        return None

    # JSON部分抽出
    match = re.search(r"\{[\s\S]*\}", json_string)
    if match:
        json_string = match.group()

    # 文字列内の余計な改行・タブ除去
    json_string = json_string.replace("\n", " ").replace("\t", " ")

    # 余分カンマ削除
    json_string = re.sub(r",\s*}", "}", json_string)
    json_string = re.sub(r",\s*\]", "]", json_string)

    # カッコ補完
    open_braces = json_string.count("{")
    close_braces = json_string.count("}")
    if close_braces < open_braces:
        json_string += "}" * (open_braces - close_braces)

    try:
        return json.loads(json_string)
    except:
        print("FINAL JSON FAIL:", json_string)
        return None


def save_schema(plot, save_path: str) -> None:
    """
    Writes the plot and suspect schema to a file for persistent storage.

    Args:
        plot: The Plot object containing the story schema.
        save_path (str): The directory path where the schema will be saved.
    """
    with open(f"{save_path}/plot_overview.txt", "w", encoding="utf-8") as f:
        f.write(plot.get_summary())


def save_timeline(timeline, save_path: str) -> None:
    """
    Writes the timeline of events to a file for persistent storage.

    Args:
        timeline: The timeline object containing the timestamps.
        save_path (str): The directory path where the timeline will be saved.
    """
    with open(f"{save_path}/timeline.txt", "w", encoding="utf-8") as f:
        f.write(f"TIME OF MURDER: {timeline.time_of_murder}\n\n")
        f.write("TIMELINE:\n")
        for timestamp in timeline.timestamps:
            f.write(f"\nTime: {timestamp.time}")
            for action in timestamp.suspect_actions:
                f.write(f"\n\t{action}\n")


def save_shared_events(shared_events, save_path: str) -> None:
    """
    Writes the shared events to a JSON file for persistent storage.

    Args:
        shared_events: The shared events object containing the interactions.
        save_path (str): The directory path where the shared events will be saved.
    """
    with open(f"{save_path}/shared_events.txt", "w", encoding="utf-8") as f:
        json.dump(shared_events, f, indent=4)


def save_shared_interactions(plot, save_path: str) -> None:
    """
    Writes the shared interactions to a file for persistent storage.

    Args:
        plot: The plot object containing the shared interactions.
        save_path (str): The directory path where the shared interactions will be saved.
    """
    with open(f"{save_path}/shared_interactions.txt", "w", encoding="utf-8") as f:
        shared_interactions = plot.shared_interactions

        for interaction in shared_interactions:
            if interaction.interaction_content is not None:
                f.write(f"TIME: {interaction.time}\n\n")
                f.write(f"Suspect a: {interaction.suspect_a}\n")
                f.write(f"Suspect b: {interaction.suspect_b}\n\n")
                f.write(f"Interaction content: \n\n{interaction.interaction_content}\n\n")


def initialize_story(save_path: str):
    """
    Orchestrates the story initialization process by generating a base story schema, parsing it,
    saving necessary information to disk, and spawning threads to write suspect accounts.

    Args:
        save_path (str): The directory path where the story elements will be saved.

    Returns:
        The plot object containing the initialized story schema and elements.
    """
    # Generate base story schema
    story_schema = llm(author_template)
    print("RAW OUTPUT ↓↓↓")
    print(story_schema)
    print("RAW OUTPUT ↑↑↑")

    if not story_schema:
        raise ValueError("Empty LLM response")    
    data = fix_trailing_commas(story_schema)

    if data is None:
        raise ValueError("JSON parse failed")

    if "plot_details" not in data or "victim" not in data.get("plot_details", {}):
        raise ValueError("Invalid JSON: missing victim")

    plot, suspects = parse_story(data)

    # Saving schema to disk
    save_schema(plot, save_path)

    # Designating timestamps at which shared interactions occur
    shared_events = llm(shared_events_template.format(story_schema=story_schema))
    parse_shared_interactions(fix_trailing_commas(shared_events), plot)

    # Saving shared events and timeline to disk
    save_shared_events(fix_trailing_commas(shared_events), save_path)
    write_timeline(plot, write_timestamp_func)

    # Generating shared interactions
    generate_shared_interactions(plot)
    save_shared_interactions(plot, save_path)

    # Creating a directory for suspect accounts
    accounts_path = os.path.join(save_path, "accounts")
    if not os.path.exists(accounts_path):
        os.mkdir(accounts_path)

    # Write suspect accounts sequentially to avoid API rate limit collisions
    for i in range(4):
        print(f"Writing account for suspect {i + 1}")
        write_suspect_account(plot, i, accounts_path)

    return plot
