"""
Run this script once to create a static save that can be loaded with option 2 in main.py.
Usage: python create_static_save.py
"""

import os
import sys
import pickle
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from story_elements.plot import Plot
from story_elements.victim import Victim
from story_elements.murder_details import MurderDetails
from story_elements.suspect import Suspect

# --- Create save directory ---
saves_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saves")
os.makedirs(saves_dir, exist_ok=True)

timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
save_path = os.path.join(saves_dir, timestamp)
os.makedirs(save_path)

# --- Story Setup ---
victim = Victim(
    name="Sir Reginald Ashworth",
    bio=(
        "Sir Reginald Ashworth, 62, was a wealthy industrialist who built his fortune "
        "in the coal and steel business. Known for his ruthless business dealings and "
        "extravagant lifestyle, he was hosting his annual charity gala at Ashworth Estate "
        "on the evening of his death. He was found collapsed in the study shortly after "
        "midnight, a glass of brandy by his side."
    )
)

murder_details = MurderDetails(
    murder_description=(
        "Sir Reginald Ashworth was poisoned with arsenic, dissolved in his evening brandy. "
        "The poison was slipped into his personal decanter in the study sometime between "
        "10:00 PM and 11:30 PM during the gala. He died alone in his study at approximately "
        "11:45 PM, while guests were still celebrating in the ballroom."
    ),
    murder_setting="The private study of Ashworth Estate, during the annual charity gala.",
    murder_weapon="Arsenic powder dissolved in brandy",
    murder_action=(
        "The killer entered the study under the pretense of retrieving documents, "
        "and emptied a vial of arsenic into Sir Reginald's personal brandy decanter."
    )
)

summary = (
    "During a lavish charity gala at Ashworth Estate, the host Sir Reginald Ashworth "
    "was found dead in his private study. Arsenic had been dissolved in his brandy. "
    "Four guests had reason to enter the study that evening — each with a motive to see "
    "Sir Reginald dead. The detective must interrogate them all to uncover the truth."
)

# --- Suspects ---
suspects_data = [
    {
        "id": 1,
        "name": "Dr. Arthur Pemberton",
        "bio": (
            "Dr. Arthur Pemberton, 55, is Sir Reginald's personal physician and longtime friend. "
            "He stands to lose his prestigious position if Sir Reginald's failing health becomes "
            "public, as rumours of negligent treatment have been circulating. He was seen near "
            "the study twice during the evening."
        ),
        "tags": ["calm", "precise", "nervous under pressure", "evasive about medical matters"],
        "victim_connection": (
            "Sir Reginald's physician for 20 years. Recently discovered that Sir Reginald "
            "was planning to replace him after a botched diagnosis."
        ),
        "guilty": False,
        "memory": (
            "I arrived at the gala at 8:00 PM as usual. Reginald seemed in good spirits, "
            "though I noticed he was drinking more than I'd advised. Around 9:30 PM, he called "
            "me to the study to discuss his recent blood work — nothing alarming, just his usual "
            "anxieties about his heart. I left the study at approximately 9:50 PM and rejoined "
            "the party. I spoke with Lady Fontaine near the fireplace until around 10:30 PM.\n\n"
            "At 10:45 PM, I returned briefly to the study to retrieve my medical bag, which I "
            "had left by the armchair. The room was empty at that time. I took my bag and left "
            "immediately, locking the door behind me — or so I thought. I then spent the rest "
            "of the evening in the east drawing room with Charles Ashworth discussing business.\n\n"
            "I heard the commotion when Reginald was found just before midnight. I rushed in and "
            "confirmed he was dead. The symptoms were consistent with arsenic poisoning. I had "
            "nothing to do with his death, though I will admit — he had told me last week that "
            "he intended to terminate my services. I was hurt, not murderous.\n\n"
            "I did not see Victoria near the study that evening, though I know she often worked "
            "late in the adjoining office. I cannot say where she was between 10 and 11 PM."
        )
    },
    {
        "id": 2,
        "name": "Victoria Hartley",
        "bio": (
            "Victoria Hartley, 34, is Sir Reginald's private secretary. Sharp, ambitious, and "
            "deeply in debt, she has worked for him for six years. Rumours suggest their "
            "relationship extended beyond professional boundaries. She was recently passed over "
            "for a promised promotion and financial settlement."
        ),
        "tags": ["composed", "intelligent", "bitter beneath the surface", "deflects personal questions"],
        "victim_connection": (
            "Sir Reginald's secretary and former intimate companion. He had recently promised "
            "her a large financial settlement upon her departure, then revoked it."
        ),
        "guilty": True,
        "memory": (
            "I arrived at the gala early to help with preparations — around 7:00 PM. By 9:00 PM "
            "the guests had arrived and I was circulating, making sure everything ran smoothly. "
            "I had a brief conversation with Sir Reginald at 9:15 PM by the drinks table. "
            "It was entirely professional.\n\n"
            "Around 10:15 PM, I went to the adjoining office to retrieve some correspondence "
            "Sir Reginald had requested. I may have stepped into the study briefly — I honestly "
            "don't recall exactly. It was a busy evening. I was in and out of several rooms.\n\n"
            "I spent most of 10:30 to 11:00 PM speaking with the gala's charity coordinator "
            "near the entrance hall. After that I returned to circulating among guests. I heard "
            "no unusual sounds from the study.\n\n"
            "I was shocked to learn of his death. Shocked. Whatever differences we had, I would "
            "never— I simply wouldn't. The settlement was a business matter. I had engaged a "
            "solicitor. There were proper channels. I had no reason to do anything so drastic.\n\n"
            "I know what people will say about me. I know how it looks. But I was not in that "
            "study after 10:30. I did not touch his decanter. I want to be very clear about that."
        )
    },
    {
        "id": 3,
        "name": "Charles Ashworth",
        "bio": (
            "Charles Ashworth, 29, is Sir Reginald's nephew and sole heir. Charming but "
            "reckless, he has accumulated significant gambling debts and has been pressing "
            "his uncle to release his inheritance early. Sir Reginald had recently threatened "
            "to write him out of the will entirely."
        ),
        "tags": ["charming", "deflects with humour", "panics when cornered", "inconsistent timeline"],
        "victim_connection": (
            "Sir Reginald's nephew and heir. Their relationship had deteriorated badly over "
            "Charles's gambling debts and demands for early inheritance."
        ),
        "guilty": False,
        "memory": (
            "Look, I'll be honest — Uncle Reginald and I had a blazing row earlier that week. "
            "He threatened to cut me out. I was furious. But that's what we did, he and I. "
            "We argued, then we got over it. I'd never actually do anything to him.\n\n"
            "The evening of the gala: I arrived fashionably late, around 8:30 PM. Had a few "
            "drinks. Tried to smooth things over with Uncle Reginald when I caught him alone "
            "near the library around 9:00 PM. He was civil enough. We didn't argue.\n\n"
            "From about 9:30 to 10:30 I was in the billiard room with some of the other guests "
            "— Forsythe and Drummond, you can ask them. We played two frames. I lost, naturally.\n\n"
            "I did wander toward the study around 10:45 PM, I'll admit. I wanted to ask Uncle "
            "Reginald about the will again. But when I got to the corridor, I saw the study door "
            "was closed and heard nothing, so I turned back. Thought better of it. Went back to "
            "the billiard room.\n\n"
            "I found out he was dead just before midnight. I won't pretend I wasn't his heir — "
            "I stand to inherit everything now. I know that looks terrible. But I didn't do it."
        )
    },
    {
        "id": 4,
        "name": "Lady Beatrice Fontaine",
        "bio": (
            "Lady Beatrice Fontaine, 58, is a socialite and old rival of Sir Reginald. Once "
            "close friends, they had a bitter falling out ten years ago over a business deal "
            "that cost her family their estate. She attended the gala at Sir Reginald's "
            "personal invitation — the first contact between them in years."
        ),
        "tags": ["imperious", "theatrical", "holds grudges", "surprisingly candid about her hatred"],
        "victim_connection": (
            "Former close friend turned bitter rival. Sir Reginald's manipulation of a joint "
            "business venture bankrupted her family a decade ago."
        ),
        "guilty": False,
        "memory": (
            "I shan't pretend I had warm feelings for Reginald. Everyone knows our history. "
            "He destroyed my family financially. I accepted his invitation tonight because I "
            "wanted to look him in the eye and let him see I had survived his treachery.\n\n"
            "I arrived at 8:15 PM and spent most of the early evening in the ballroom. I did "
            "speak to Reginald directly at around 9:45 PM — a brief, cold exchange by the "
            "portrait gallery. He was smug as ever. I told him what I thought of him and walked "
            "away. Several guests witnessed it.\n\n"
            "Between 10:00 PM and 11:00 PM, I was almost entirely in the ballroom and then the "
            "west sitting room. I spoke at length with Dr. Pemberton around 10:15 PM, and later "
            "with the Countess of Wellsbury near the terrace doors.\n\n"
            "I did not go near the study. I had no interest in being alone with Reginald, or "
            "anywhere near his private rooms. My grievance with him was public, not secret. "
            "If I had wanted revenge, I would have taken it through the courts — as I have been "
            "doing for three years.\n\n"
            "Yes, I hated him. But hatred is not the same as murder, detective."
        )
    }
]

# --- Build Suspect objects and write memory files ---
suspect_objects = []
for data in suspects_data:
    suspect = Suspect(
        name=data["name"],
        bio=data["bio"],
        tags=data["tags"],
        victim_connection=data["victim_connection"],
        guilty=data["guilty"],
        id=data["id"]
    )
    memory_filename = f"suspect_{data['id']}_memory.txt"
    memory_path = os.path.join(save_path, memory_filename)
    with open(memory_path, "w", encoding="utf-8") as f:
        f.write(data["memory"])
    suspect.memory_path = memory_path
    suspect_objects.append(suspect)

# --- Assemble Plot ---
plot = Plot(
    summary=summary,
    victim=victim,
    murder_details=murder_details,
    suspects=suspect_objects
)

# --- Save as pickle ---
plot_path = os.path.join(save_path, "plot.pkl")
with open(plot_path, "wb") as f:
    pickle.dump(plot, f)

print(f"Static save created at: {save_path}")
print("Run 'python main.py' and choose option 2 to load it.")
