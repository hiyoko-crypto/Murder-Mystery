"""Simple i18n module. Call set_lang("en"|"ja") once at startup, then use t()."""

_lang = "en"

_STRINGS = {
    "en": {
        # case briefing
        "setting_label":          "Setting",
        "victim_label":           "Victim  ",
        "murder_time_label":      "Murder time",
        "discovery_time_label":   "Discovered",
        "weapon_label":           "Weapon  ",
        "scene_label":            "Scene   ",
        "opening_msg":            "The dressing room has been secured. You may begin your investigation.",
        "hint_commands":          'Type "examine" to inspect the scene, "switch" to change suspects, "quit" to exit.',
        # examine menu
        "nothing_to_examine":     "Nothing to examine yet.",
        "investigate_header":     "  INVESTIGATE",
        "locations_label":        "Locations:",
        "items_label":            "Found items:",
        "examined_tag":           " [examined]",
        "new_tag":                " [NEW]",
        "examine_prompt":         "Enter number (1-{n}) or press Enter to cancel: ",
        "invalid_choice":         "Invalid choice.",
        "invalid_input":          "Invalid input.",
        # examine location
        "you_find":               "You find:",
        "examine_items_hint":     "(Examine these items individually for closer inspection.)",
        "previously_found":       "Previously found here: {names}",
        "nothing_new":            "Nothing new found here.",
        # examine item
        "detective_note":         "Detective's note: ",
        "new_location_unlocked":  "[!] This leads somewhere — {name} is now available to examine.",
        # suspect selection
        "interrogate_header":     "  WHO WOULD YOU LIKE TO INTERROGATE?",
        "indict_option":          "Indict a suspect",
        "examine_hint":           '  (or type "examine" to investigate the scene)',
        "enter_number":           "Enter number: ",
        "now_questioning":        "Now questioning: {name}",
        # indict
        "murderer_header":        "  WHO IS THE MURDERER?",
        "motive_label":           "Motive",
        "you_accuse":             "You accuse: {name}",
        "reason_prompt":          "Explain your reasoning: ",
        "reason_accepted":        "Reason accepted.",
        "reason_rejected":        "Reason rejected.",
        "proof_score":            "Proof score: {score}/{minimum}",
        "matched_proof":          "Matched proof groups: {groups}",
        "missing_required":       "Missing required proof groups: {groups}",
        "correct":                "✓ Correct. {name} is the murderer.",
        "indictment_failed":      "✗ Indictment failed.",
        "correct_detail1":        "  She entered Marcus's locked dressing room through the ventilation shaft",
        "correct_detail2":        "  and struck him with the brass candlestick during intermission.",
        "case_closed":            "Case closed.",
        "wrong":                  "✗ Wrong. {name} is innocent.",
        "killer_free":            "  The real killer is still free.",
        # game loop
        "question_prompt":        'Your question (or "switch" / "examine" / "quit"): ',
        "goodbye":                "Goodbye!",
        "response_header":        "SUSPECT RESPONSE:",
        "new_location":           "[!] New location available to examine: {name}",
        "building_agents":        "Building suspect agents...",
    },
    "ja": {
        # case briefing
        "setting_label":          "舞台",
        "victim_label":           "被害者",
        "murder_time_label":      "事件発生時刻",
        "discovery_time_label":   "事件発覚時刻",
        "weapon_label":           "凶器",
        "scene_label":            "現場",
        "opening_msg":            "楽屋は封鎖されました。捜査を開始してください。",
        "hint_commands":          '"examine" で現場調査、"switch" で容疑者変更、"quit" で終了。',
        # examine menu
        "nothing_to_examine":     "まだ調査できる場所がありません。",
        "investigate_header":     "  現場調査",
        "locations_label":        "場所:",
        "items_label":            "発見した物:",
        "examined_tag":           " [調査済]",
        "new_tag":                " [新規]",
        "examine_prompt":         "番号を入力（1-{n}）、またはEnterでキャンセル: ",
        "invalid_choice":         "無効な選択です。",
        "invalid_input":          "無効な入力です。",
        # examine location
        "you_find":               "以下のものを発見しました:",
        "examine_items_hint":     "（各アイテムを個別に調べると詳細がわかります。）",
        "previously_found":       "以前ここで発見: {names}",
        "nothing_new":            "新しいものは見つかりませんでした。",
        # examine item
        "detective_note":         "探偵のメモ: ",
        "new_location_unlocked":  "[!] 手がかりから新たな場所が判明 — {name} を調査できます。",
        # suspect selection
        "interrogate_header":     "  誰を尋問しますか？",
        "indict_option":          "犯人を指名する",
        "examine_hint":           '  （または "examine" で現場を調査）',
        "enter_number":           "番号を入力: ",
        "now_questioning":        "尋問中: {name}",
        # indict
        "murderer_header":        "  犯人は誰ですか？",
        "motive_label":           "動機",
        "you_accuse":             "あなたの指名: {name}",
        "reason_prompt":          "理由を入力してください: ",
        "reason_accepted":        "理由は妥当です。",
        "reason_rejected":        "理由が不十分です。",
        "proof_score":            "推理スコア: {score}/{minimum}",
        "matched_proof":          "成立した証明グループ: {groups}",
        "missing_required":       "不足している必須グループ: {groups}",
        "correct":                "✓ 正解。{name} が犯人です。",
        "indictment_failed":      "✗ 指名は成立しませんでした。",
        "correct_detail1":        "  彼女は換気口を通じてMarcusの鍵のかかった楽屋に侵入し、",
        "correct_detail2":        "  幕間に真鍮の燭台で彼を殴打しました。",
        "case_closed":            "事件解決。",
        "wrong":                  "✗ 不正解。{name} は無実です。",
        "killer_free":            "  真の犯人はまだ逃走中です。",
        # game loop
        "question_prompt":        '"switch" / "examine" / "quit" または質問を入力: ',
        "goodbye":                "ゲームを終了します。",
        "response_header":        "容疑者の回答:",
        "new_location":           "[!] 新たな場所が調査可能になりました: {name}",
        "building_agents":        "容疑者エージェントを構築中...",
    },
}


def set_lang(lang: str) -> None:
    global _lang
    if lang not in _STRINGS:
        raise ValueError(f"Unsupported language: {lang}")
    _lang = lang


def get_lang() -> str:
    return _lang


def t(key: str, **kwargs) -> str:
    text = _STRINGS.get(_lang, _STRINGS["en"]).get(key, key)
    return text.format(**kwargs) if kwargs else text
