"""
generate_story.py — Story generation only.

Generates a new mystery story and saves it to disk, then exits.
Run this once to prepare a story, then use main.py (Load a save) to play it.
"""

import sys
import shutil
import time
import traceback

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from modules.make_save import make_save
from modules.story_init import initialize_story
from story_elements.pickle_plot import save_plot

MAX_RETRIES = 3


def main():
    retries = 0
    while retries < MAX_RETRIES:
        save_path = None
        try:
            save_path = make_save()
            print(f"Save directory: {save_path}")
            print("Generating story... (this may take several minutes)")
            plot = initialize_story(save_path)
            save_plot(plot, save_path)
            print(f"\nDone! Story saved to: {save_path}")
            print("Run 'py main.py' and choose option 2 (Load a save) to play.")
            return
        except Exception as e:
            retries += 1
            print(f"Error in story generation: {e}")
            traceback.print_exc()
            if retries < MAX_RETRIES:
                print(f"Retrying... ({retries}/{MAX_RETRIES})")
                time.sleep(3)
                if save_path is not None:
                    shutil.rmtree(save_path, ignore_errors=True)
            else:
                print("Max retries reached. Exiting.")
                sys.exit(1)


if __name__ == "__main__":
    main()
