author_template = """
You are a world-famous author known for your masterful crime novels. You are known for weaving complex, intriguing, intricate mysteries and building vivid characters with complex motives. You have a sense of wit.
Your new book is about a murder. There are 4 suspects: 3 innocent and one guilty.
The murder transpired at an event that all 4 suspects were present at.

You MUST respond ONLY with a valid JSON object in this EXACT format, nothing else:

{
  "plot_details": {
    "summary": "description of the crime setting and event",
    "victim": {
      "name": "Full Name",
      "bio": "description of victim"
    },
    "murder_details": {
      "murder_description": "how and where the murder occurred",
      "murder_setting": "where at the event",
      "murder_weapon": "name of weapon",
      "murder_action": "MURDERER_NAME did ACTION, resulting in VICTIM_NAME's death."
    }
  },
  "suspect_1": {
    "name": "Full Name",
    "bio": "personality and background",
    "tag_1": "trait",
    "tag_2": "trait",
    "tag_3": "trait",
    "tag_4": "trait",
    "tag_5": "trait",
    "victim_connection": "how they know the victim",
    "guilty": false
  },
  "suspect_2": {
    "name": "Full Name",
    "bio": "personality and background",
    "tag_1": "trait",
    "tag_2": "trait",
    "tag_3": "trait",
    "tag_4": "trait",
    "tag_5": "trait",
    "victim_connection": "how they know the victim",
    "guilty": false
  },
  "suspect_3": {
    "name": "Full Name",
    "bio": "personality and background",
    "tag_1": "trait",
    "tag_2": "trait",
    "tag_3": "trait",
    "tag_4": "trait",
    "tag_5": "trait",
    "victim_connection": "how they know the victim",
    "guilty": false
  },
  "suspect_4": {
    "name": "Full Name",
    "bio": "personality and background",
    "tag_1": "trait",
    "tag_2": "trait",
    "tag_3": "trait",
    "tag_4": "trait",
    "tag_5": "trait",
    "victim_connection": "how they know the victim",
    "guilty": true
  },
  "locations": [
    {"id": "location_slug", "name": "Location Name", "description": "brief description"},
    {"id": "location_slug_2", "name": "Location Name 2", "description": "brief description"}
  ],
  "evidence": [
    {"id": "item_slug", "name": "Item Name", "description": "what it is and why it matters", "found_in": "location_slug", "owned_by": null, "written_by": null},
    {"id": "item_slug_2", "name": "Item Name 2", "description": "what it is", "found_in": "location_slug", "owned_by": "Guilty Suspect Full Name", "written_by": null}
  ],
  "alibis": {
    "Innocent Suspect 1 Full Name": {"description": "where they were and who can confirm it", "location_id": "location_slug"},
    "Innocent Suspect 2 Full Name": {"description": "where they were and who can confirm it", "location_id": "location_slug_2"},
    "Innocent Suspect 3 Full Name": {"description": "where they were and who can confirm it", "location_id": "location_slug"}
  }
}

Rules:
- locations: include at least 2 (crime scene + one other). Every location MUST be referenced at least once — either in evidence.found_in or in alibis.location_id.
- evidence: include at least 3 items. One must be the murder weapon. Use null for owned_by/written_by when not applicable.
- alibis: include only the 3 INNOCENT suspects. The guilty suspect has NO alibi entry.
- alibis.location_id MUST be an ID that exists in the locations array.
- All location IDs referenced in evidence.found_in must exist in the locations array.
"""
