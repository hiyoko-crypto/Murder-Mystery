"""
Game loop for the KG-grounded murder mystery.
Commands: switch / examine / quit / indict (via suspect menu)
"""

import sys
from modules.scenario_loader import ScenarioLoader
from modules.location_tracker import LocationTracker
from suspect_agents.suspect_agent_kg import SuspectAgentKG
from suspect_agents.commitment_ledger import CommitmentLedger

SEP = "=" * 60


# ── Startup ──────────────────────────────────────────────────────────

def _print_case_briefing(loader: ScenarioLoader) -> None:
    md = loader.get_murder_details()
    print(f"\n{SEP}")
    print(f"  {loader.get_title()}")
    print(SEP)
    print(f"Setting : {loader.get_setting()}")
    print(f"Victim  : {md.get('summary', '')}")
    print(f"Weapon  : {md.get('weapon', '')}")
    print(f"Scene   : {md.get('setting', '')}")
    print(SEP)
    print("\nThe dressing room has been secured. You may begin your investigation.")
    print('Type "examine" to inspect the scene, "switch" to change suspects, "quit" to exit.\n')


# ── Examine ──────────────────────────────────────────────────────────

def _run_examine(tracker: LocationTracker, loader: ScenarioLoader) -> None:
    locs  = tracker.get_available_locations()
    items = tracker.get_found_items()

    if not locs and not items:
        print("Nothing to examine yet.")
        return

    print(f"\n{SEP}")
    print("  INVESTIGATE")
    print(SEP)

    options = []  # (display_label, kind, id)

    if locs:
        print("Locations:")
        for loc_id in locs:
            name   = loader.get_node_name(loc_id)
            status = " [examined]" if tracker.is_examined(loc_id) else " [NEW]"
            print(f"  {len(options) + 1}. {name}{status}")
            options.append(("location", loc_id))

    if items:
        print("Found items:")
        for item_id in items:
            name = loader.get_node_name(item_id)
            print(f"  {len(options) + 1}. {name}")
            options.append(("item", item_id))

    print(f"\nEnter number (1-{len(options)}) or press Enter to cancel: ", end="")
    choice = input().strip()
    if not choice:
        return

    try:
        idx = int(choice) - 1
        if not (0 <= idx < len(options)):
            print("Invalid choice.")
            return
    except ValueError:
        print("Invalid input.")
        return

    kind, target_id = options[idx]

    if kind == "location":
        _do_examine_location(tracker, loader, target_id)
    else:
        _do_examine_item(tracker, loader, target_id)


def _do_examine_location(tracker: LocationTracker, loader: ScenarioLoader, loc_id: str) -> None:
    result = tracker.examine_location(loc_id)

    print(f"\n── {loader.get_node_name(loc_id)} ──")
    print(result["description"])

    if result["newly_found"]:
        print("\nYou find:")
        for item_id in result["newly_found"]:
            props = loader.nodes[item_id]["properties"]
            print(f"  • {props['name']} — {props['description']}")
        print('\n(Examine these items individually for closer inspection.)')

    if result["already_found"]:
        already_names = [loader.nodes[i]["properties"]["name"] for i in result["already_found"]]
        print(f"\nPreviously found here: {', '.join(already_names)}")

    if not result["newly_found"] and not result["already_found"]:
        print("\nNothing new found here.")


def _do_examine_item(tracker: LocationTracker, loader: ScenarioLoader, item_id: str) -> None:
    result = tracker.examine_item(item_id)

    print(f"\n── {result['name']} ──")
    print(result["description"])
    if result["significance"]:
        print(f"\nDetective's note: {result['significance']}")

    if result["unlocked_location"]:
        loc_name = loader.get_node_name(result["unlocked_location"])
        print(f"\n[!] This leads somewhere — {loc_name} is now available to examine.")


# ── Suspect selection ─────────────────────────────────────────────────

def _choose_suspect(agents: list, tracker: LocationTracker, loader: ScenarioLoader):
    while True:
        print(f"\n{SEP}")
        print("  WHO WOULD YOU LIKE TO INTERROGATE?")
        print(SEP)
        for i, agent in enumerate(agents, 1):
            print(f"  {i}. {agent.suspect_name}")
        print(f"  {len(agents) + 1}. Indict a suspect")
        print(f'  (or type "examine" to investigate the scene)')

        choice = input("Enter number: ").strip()

        if choice.lower() == "examine":
            _run_examine(tracker, loader)
            continue

        try:
            n = int(choice)
        except ValueError:
            print("Invalid input.")
            continue

        if 1 <= n <= len(agents):
            print(f"\nNow questioning: {agents[n-1].suspect_name}")
            return agents[n - 1].get_suspect_response
        elif n == len(agents) + 1:
            return None
        else:
            print("Invalid choice.")


# ── Indict ───────────────────────────────────────────────────────────

def _indict(agents: list) -> None:
    print(f"\n{SEP}")
    print("  WHO IS THE MURDERER?")
    print(SEP)
    for i, agent in enumerate(agents, 1):
        props = agent.subgraph["node"]["properties"]
        print(f"  {i}. {agent.suspect_name}")
        print(f"     Motive: {props.get('victim_connection', '')}")

    while True:
        choice = input("\nEnter number: ").strip()
        try:
            n = int(choice)
            if 1 <= n <= len(agents):
                break
        except ValueError:
            pass
        print("Invalid choice.")

    accused = agents[n - 1]
    print(f"\nYou accuse: {accused.suspect_name}")
    if accused.guilty:
        print(f"\n✓ Correct. {accused.suspect_name} is the murderer.")
        print("  She entered Marcus's locked dressing room through the ventilation shaft")
        print("  and struck him with the brass candlestick during intermission.")
        print("\nCase closed.")
    else:
        print(f"\n✗ Wrong. {accused.suspect_name} is innocent.")
        print("  The real killer is still free.")
    sys.exit(0)


# ── Main game loop ────────────────────────────────────────────────────

def build_and_run_game(scenario_path: str) -> None:
    loader  = ScenarioLoader(scenario_path)
    ledger  = CommitmentLedger()
    tracker = LocationTracker(loader)

    _print_case_briefing(loader)

    print("Building suspect agents...")
    agents = [
        SuspectAgentKG(loader, node_id, ledger)
        for node_id in loader.get_all_suspect_node_ids()
    ]
    print()

    current_fn = _choose_suspect(agents, tracker, loader)
    current_agent = None  # track which agent is active for testimony unlocking

    # Map response function → agent
    fn_to_agent = {a.get_suspect_response: a for a in agents}

    while True:
        prompt = 'Your question (or "switch" / "examine" / "quit"): '
        user_input = input(f"\n{prompt}").strip()

        if not user_input:
            continue

        if user_input.lower() == "quit":
            print("Goodbye!")
            break

        elif user_input.lower() == "switch":
            current_fn = _choose_suspect(agents, tracker, loader)
            if current_fn is None:
                _indict(agents)

        elif user_input.lower() == "examine":
            _run_examine(tracker, loader)

        else:
            if current_fn is None:
                _indict(agents)
                continue

            print("\nSUSPECT RESPONSE:\n")
            response = current_fn(user_input)
            print(response)

            # Testimony-based location unlocking
            active_agent = fn_to_agent.get(current_fn)
            if active_agent:
                newly = tracker.unlock_from_testimony(active_agent.last_used_edge_ids)
                for loc_id in newly:
                    loc_name = loader.get_node_name(loc_id)
                    print(f"\n[!] New location available to examine: {loc_name}")
