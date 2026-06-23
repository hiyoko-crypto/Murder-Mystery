"""
Entry point for the KG-grounded murder mystery game.

Usage:
    python main_kg.py
    python main_kg.py --scenario scenarios/the_final_act.json
"""

import sys
import os

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_SCENARIO = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "scenarios", "the_final_act.json"
)


def _select_language() -> str:
    print("Select language / 言語を選択してください:")
    print("  1. English")
    print("  2. 日本語")
    while True:
        choice = input("Enter 1 or 2: ").strip()
        if choice == "1":
            return "en"
        if choice == "2":
            return "ja"
        print("Please enter 1 or 2.")


def main() -> None:
    scenario_path = DEFAULT_SCENARIO

    # Optional CLI argument: --scenario <path>
    args = sys.argv[1:]
    if "--scenario" in args:
        idx = args.index("--scenario")
        if idx + 1 < len(args):
            scenario_path = args[idx + 1]

    if not os.path.exists(scenario_path):
        print(f"Scenario file not found: {scenario_path}")
        sys.exit(1)

    language = _select_language()

    from suspect_agents.run_game_kg import build_and_run_game
    build_and_run_game(scenario_path, language)


if __name__ == "__main__":
    main()
