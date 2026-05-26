shared_events_template = """
You are generating a timeline for a murder mystery event.
Based on the plot schema below, create a timeline of 10 timestamps (15-minute intervals).

PLOT SCHEMA:
{story_schema}

RULES:
- Do NOT include the victim or a detective in interactions.
- Include AT LEAST 3 interaction pairs across the 10 timestamps.
- All times in format HH:MM AM/PM.

Respond ONLY with a valid JSON object in this EXACT format:

{{
  "timestamp_1": {{
    "time": "08:00 PM",
    "shared_event": "Guests begin to arrive at the manor.",
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_2": {{
    "time": "08:15 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{
      "interaction_id": "interaction_1",
      "suspect_a": "Suspect Name A",
      "suspect_b": "Suspect Name B"
    }}
  }},
  "timestamp_3": {{
    "time": "08:30 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_4": {{
    "time": "08:45 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{
      "interaction_id": "interaction_2",
      "suspect_a": "Suspect Name C",
      "suspect_b": "Suspect Name D"
    }}
  }},
  "timestamp_5": {{
    "time": "09:00 PM",
    "shared_event": "A loud crash is heard from the study.",
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_6": {{
    "time": "09:15 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{
      "interaction_id": "interaction_3",
      "suspect_a": "Suspect Name A",
      "suspect_b": "Suspect Name C"
    }}
  }},
  "timestamp_7": {{
    "time": "09:30 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_8": {{
    "time": "09:45 PM",
    "shared_event": "The victim is found dead.",
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_9": {{
    "time": "10:00 PM",
    "shared_event": null,
    "suspect_interaction_pairs": {{}}
  }},
  "timestamp_10": {{
    "time": "10:15 PM",
    "shared_event": "Police arrive at the manor.",
    "suspect_interaction_pairs": {{}}
  }}
}}
"""


# NEED TO MAKE SURE 