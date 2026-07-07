"""
CLI wrapper for GameSession.
All game logic lives in game_session.py — this file only handles input/output.
"""

import sys
from game_session import GameSession
from modules.i18n import t

SEP = "=" * 60


# ── Briefing ──────────────────────────────────────────────────────────

def _print_briefing(briefing: dict) -> None:
    print(f"\n{SEP}")
    print(f"  {briefing['title']}")
    print(SEP)
    print(f"{t('setting_label')} : {briefing['setting']}")
    print(f"{t('victim_label')}  : {briefing['victim']}")
    print(f"{t('murder_time_label')} : {briefing['time_of_murder']}")
    print(f"{t('discovery_time_label')} : {briefing['time_discovered']}")
    print(f"{t('weapon_label')}  : {briefing['weapon']}")
    print(f"{t('scene_label')}   : {briefing['scene']}")
    print(SEP)
    print(f"\n{t('opening_msg')}")
    print(f"{t('hint_commands')}\n")


# ── Examine ───────────────────────────────────────────────────────────

def _run_examine(session: GameSession) -> None:
    options = session.get_examine_options()
    locs  = options["locations"]
    items = options["items"]

    if not locs and not items:
        print(t("nothing_to_examine"))
        return

    print(f"\n{SEP}")
    print(t("investigate_header"))
    print(SEP)

    menu = []  # (kind, id)

    if locs:
        print(t("locations_label"))
        for loc in locs:
            status = t("examined_tag") if loc.examined else t("new_tag")
            print(f"  {len(menu) + 1}. {loc.name}{status}")
            menu.append(("location", loc.id))

    if items:
        print(t("items_label"))
        for item in items:
            print(f"  {len(menu) + 1}. {item.name}")
            menu.append(("item", item.id))

    print(f"\n{t('examine_prompt', n=len(menu))}", end="")
    choice = input().strip()
    if not choice:
        return

    try:
        idx = int(choice) - 1
        if not (0 <= idx < len(menu)):
            print(t("invalid_choice"))
            return
    except ValueError:
        print(t("invalid_input"))
        return

    kind, target_id = menu[idx]

    if kind == "location":
        result = session.examine_location(target_id)
        loc_name = next(l.name for l in locs if l.id == target_id)
        print(f"\n── {loc_name} ──")
        print(result.description)
        if result.newly_found:
            print(f"\n{t('you_find')}")
            for item in result.newly_found:
                print(f"  • {item.name} — {item.description}")
            print(f"\n{t('examine_items_hint')}")
        if result.already_found:
            names = ", ".join(i.name for i in result.already_found)
            print(f"\n{t('previously_found', names=names)}")
        if not result.newly_found and not result.already_found:
            print(f"\n{t('nothing_new')}")

    else:
        detail = session.examine_item(target_id)
        print(f"\n── {detail.name} ──")
        print(detail.description)
        if detail.significance:
            print(f"\n{t('detective_note')}{detail.significance}")
        if detail.unlocked_location:
            options2 = session.get_examine_options()
            loc_name = next(
                (l.name for l in options2["locations"] if l.id == detail.unlocked_location),
                detail.unlocked_location
            )
            print(f"\n{t('new_location_unlocked', name=loc_name)}")


# ── Suspect selection ─────────────────────────────────────────────────

def _choose_suspect(session: GameSession) -> bool:
    """
    Show suspect menu. Returns False if player chose to indict.
    """
    briefing = session.get_briefing()
    suspects = briefing["suspects"]

    while True:
        print(f"\n{SEP}")
        print(t("interrogate_header"))
        print(SEP)
        for i, s in enumerate(suspects, 1):
            print(f"  {i}. {s.name}")
        print(f"  {len(suspects) + 1}. {t('indict_option')}")
        print(t("examine_hint"))

        choice = input(t("enter_number")).strip()

        if choice.lower() == "examine":
            _run_examine(session)
            continue

        try:
            n = int(choice)
        except ValueError:
            print(t("invalid_input"))
            continue

        if 1 <= n <= len(suspects):
            info = session.switch_suspect(suspects[n - 1].id)
            print(f"\n{t('now_questioning', name=info.name)}")
            return True
        elif n == len(suspects) + 1:
            return False
        else:
            print(t("invalid_choice"))


# ── Indict ────────────────────────────────────────────────────────────

def _run_indict(session: GameSession) -> None:
    briefing = session.get_briefing()
    suspects = briefing["suspects"]

    print(f"\n{SEP}")
    print(t("murderer_header"))
    print(SEP)
    for i, s in enumerate(suspects, 1):
        print(f"  {i}. {s.name}")

    while True:
        choice = input(f"\n{t('enter_number')}").strip()
        try:
            n = int(choice)
            if 1 <= n <= len(suspects):
                break
        except ValueError:
            pass
        print(t("invalid_choice"))

    reason = input(f"\n{t('reason_prompt')}").strip()
    result = session.indict(suspects[n - 1].id, reason)
    print(f"\n{t('you_accuse', name=result.accused_name)}")
    evaluation = result.evaluation
    passed_names = ", ".join(g["id"] for g in evaluation.get("passed_groups", [])) or "-"
    missing_required = ", ".join(g["id"] for g in evaluation.get("failed_required_groups", [])) or "-"
    print(t("proof_score", score=evaluation.get("score", 0), minimum=evaluation.get("minimum_score", 0)))
    print(t("matched_proof", groups=passed_names))
    if missing_required != "-":
        print(t("missing_required", groups=missing_required))

    if result.won:
        print(f"\n{t('correct', name=result.accused_name)}")
        print(t("reason_accepted"))
        print(f"\n{result.message}")
        print(f"\n{t('case_closed')}")
    else:
        if result.correct:
            print(f"\n{t('indictment_failed')}")
            print(t("reason_rejected"))
        else:
            print(f"\n{t('wrong', name=result.accused_name)}")
        print(result.message)
    sys.exit(0)


# ── Main game loop ────────────────────────────────────────────────────

def build_and_run_game(scenario_path: str, language: str) -> None:
    print(t("building_agents"))
    session = GameSession(scenario_path, language)

    _print_briefing(session.get_briefing())
    active = _choose_suspect(session)
    if not active:
        _run_indict(session)

    while True:
        user_input = input(f"\n{t('question_prompt')}").strip()

        if not user_input:
            continue

        if user_input.lower() == "quit":
            print(t("goodbye"))
            break

        elif user_input.lower() == "switch":
            active = _choose_suspect(session)
            if not active:
                _run_indict(session)

        elif user_input.lower() == "examine":
            _run_examine(session)

        else:
            print(f"\n{t('response_header')}\n")
            response = session.ask(user_input)
            print(response)

            state = session.get_state()
            for loc in state.available_locations:
                if loc.is_new:
                    print(f"\n{t('new_location', name=loc.name)}")
