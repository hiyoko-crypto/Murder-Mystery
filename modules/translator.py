"""
Translation layer for Japanese mode.

Japanese detective questions are translated into English before KG reasoning.
Validated English suspect responses are translated into Japanese for display.
Both prompts enforce strict fact-preservation.
"""

from modules.llm_client import llm

_QUESTION_PROMPT = """\
Translate the following detective's question into clear English for an internal murder mystery interrogation system.

Rules (strictly follow all):
- Do NOT answer the question.
- Do NOT add, remove, infer, or alter any factual content.
- Preserve times, uncertainty, accusations, names, locations, and evidence references exactly.
- Use the name mappings provided below for proper nouns.
- Return ONLY the translated English question. No explanation, no JSON wrapper.

{name_hint}Question to translate:
{text}"""


_RESPONSE_PROMPT = """\
Translate the following suspect's dialogue into natural Japanese.

Rules (strictly follow all):
- Do NOT add, remove, infer, or alter any factual content.
- Preserve uncertainty, evasiveness, and contradictions exactly as written.
- Preserve the character's tone (calm, nervous, blunt, defensive, etc.).
- Use the name mappings provided below for proper nouns.
- Return ONLY the translated dialogue. No explanation, no JSON wrapper.

{name_hint}Dialogue to translate:
{text}"""


_DISPLAY_TEXT_PROMPT = """\
Translate the following murder mystery game text into natural Japanese.

Rules (strictly follow all):
- Do NOT add, remove, infer, or alter any factual content.
- Preserve times, quantities, uncertainty, clues, locations, evidence, and names exactly in meaning.
- Use the name mappings provided below for proper nouns.
- Keep the text concise and suitable for UI display.
- Return ONLY the translated Japanese text. No explanation, no JSON wrapper.

{name_hint}Text to translate:
{text}"""


def _format_name_hint(display_names: dict = None, reverse: bool = False) -> str:
    if not display_names:
        return ""

    if reverse:
        mappings = "\n".join(f'  "{ja}" -> "{en}"' for en, ja in display_names.items())
    else:
        mappings = "\n".join(f'  "{en}" -> "{ja}"' for en, ja in display_names.items())
    return f"Name mappings:\n{mappings}\n\n"


def translate_question_to_english(text: str, display_names: dict = None) -> str:
    name_hint = _format_name_hint(display_names, reverse=True)
    prompt = _QUESTION_PROMPT.format(name_hint=name_hint, text=text)
    return llm(prompt, temperature=0.2).strip()


def translate_response(text: str, display_names: dict = None) -> str:
    name_hint = _format_name_hint(display_names, reverse=False)
    prompt = _RESPONSE_PROMPT.format(name_hint=name_hint, text=text)
    return llm(prompt, temperature=0.3).strip()


def translate_display_text(text: str, display_names: dict = None) -> str:
    if not text:
        return text
    name_hint = _format_name_hint(display_names, reverse=False)
    prompt = _DISPLAY_TEXT_PROMPT.format(name_hint=name_hint, text=text)
    return llm(prompt, temperature=0.2).strip()
